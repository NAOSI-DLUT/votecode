import { db, schema } from "@nuxthub/db";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  isNotNull,
  sql,
} from "drizzle-orm";
import { Message, rawTool, streamText } from "xsai";

type PendingPromptRow = {
  id: number;
  pageId: string;
  userId: number;
  pending: boolean;
  content: string;
  response: string | null;
  createdAt: Date;
  voteCount: number;
  userName: string | null;
};

function pickBestPrompt(pendingPrompts: PendingPromptRow[]): PendingPromptRow {
  return pendingPrompts.reduce((max, prompt) => {
    return prompt.voteCount > max.voteCount ? prompt : max;
  }, pendingPrompts[0]!);
}

async function loadPendingPrompts(
  tx: any,
  pageId: string,
): Promise<PendingPromptRow[]> {
  return tx
    .select({
      ...getTableColumns(schema.prompts),
      voteCount: count(schema.votes),
      userName: schema.users.name,
    })
    .from(schema.prompts)
    .where(
      and(eq(schema.prompts.pageId, pageId), eq(schema.prompts.pending, true)),
    )
    .leftJoin(schema.votes, eq(schema.prompts.id, schema.votes.promptId))
    .leftJoin(schema.users, eq(schema.prompts.userId, schema.users.id))
    .groupBy(schema.prompts.id, schema.users.name);
}

async function loadHistoryPrompts(tx: any, pageId: string) {
  return tx
    .select({
      userId: schema.prompts.userId,
      content: schema.prompts.content,
      response: schema.prompts.response,
    })
    .from(schema.prompts)
    .where(
      and(
        eq(schema.prompts.pageId, pageId),
        isNotNull(schema.prompts.response),
      ),
    )
    .orderBy(desc(schema.prompts.createdAt))
    .limit(5);
}

async function runModel(
  pageId: string,
  bestPrompt: Pick<PendingPromptRow, "id" | "content">,
  pageHtml: string,
  historyPrompts: any[],
) {
  const storage = useStorage();
  let latestHtml = pageHtml;

  const readHtmlTool = rawTool({
    name: "read_html",
    description: "Read current complete HTML content",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: async () => latestHtml,
  });

  const writeHtmlTool = rawTool<{ html: string }>({
    name: "write_html",
    description: "Write full updated HTML content",
    parameters: {
      type: "object",
      properties: {
        html: {
          type: "string",
          description: "The complete updated HTML document",
        },
      },
      required: ["html"],
      additionalProperties: false,
    },
    execute: async ({ html }) => {
      latestHtml = html;
      await storage.setItem(`pages:${pageId}:html`, latestHtml);
      return "ok";
    },
  });

  const result = streamText({
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: process.env.OPENAI_BASE_URL!,
    model: process.env.OPENAI_MODEL!,
    messages: [
      {
        role: "system",
        content:
          "You are a web programming assistant. Use tools to read and write HTML. You MUST call read_html first to get current HTML, and call write_html with the complete updated HTML when changes are needed. In final answer, return only your user-facing response text.",
      },
      ...(historyPrompts
        .reverse()
        .map((msg) => [
          { role: "user", content: msg.content },
          { role: "assistant", content: msg.response },
        ])
        .flat() as Message[]),
      {
        role: "user",
        content: bestPrompt.content,
      },
    ],
    maxSteps: 6,
    tools: [readHtmlTool, writeHtmlTool],
  });

  let responseText = "";
  for await (const chunk of result.textStream) {
    responseText += chunk;
    await storage.setItem(`pages:${pageId}:prompts:${bestPrompt.id}`, {
      response: responseText,
    });
  }

  if (!responseText.trim()) {
    throw createError({
      statusCode: 500,
      statusMessage: "Model returned empty response",
    });
  }

  return {
    response: responseText.trim(),
    html: latestHtml,
  };
}

async function generateForPage(pageId: string) {
  const startedAt = Date.now();
  const storage = useStorage();

  await db.transaction(async (tx) => {
    const lockResult = await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(hashtext(${pageId})) as lock`,
    );
    const lock = lockResult[0]?.lock as boolean;

    if (!lock) {
      throw createError({
        statusCode: 409,
        statusMessage: "Another generate is already running for this page",
      });
    }

    const page = await tx.query.pages.findFirst({
      where: eq(schema.pages.id, pageId),
    });

    if (!page) {
      throw createError({
        statusCode: 404,
        statusMessage: "Page not found",
      });
    }

    const pendingPrompts = await loadPendingPrompts(tx, pageId);
    if (!pendingPrompts[0]) {
      return;
    }

    const bestPrompt = pickBestPrompt(pendingPrompts) as PendingPromptRow;
    const historyPrompts = await loadHistoryPrompts(tx, pageId);

    const finalChunk = await runModel(
      pageId,
      bestPrompt,
      page.html,
      historyPrompts,
    );

    await storage.setItem(`pages:${pageId}:prompts:${bestPrompt.id}`, {
      response: finalChunk.response,
    });
    if (finalChunk.html) {
      await storage.setItem(`pages:${pageId}:html`, finalChunk.html);
    }

    await tx
      .update(schema.prompts)
      .set({ pending: false })
      .where(
        and(
          eq(schema.prompts.pageId, pageId),
          eq(schema.prompts.pending, true),
        ),
      );

    await tx
      .update(schema.prompts)
      .set({ response: finalChunk.response })
      .where(eq(schema.prompts.id, bestPrompt.id));

    await tx
      .update(schema.pages)
      .set({ html: finalChunk.html })
      .where(eq(schema.pages.id, pageId));

    await storage.setItem(`pages:${pageId}:refresh`, true);
    console.info(
      `[generate] room=${pageId} status=success durationMs=${Date.now() - startedAt}`,
    );
  });
}

export default defineTask({
  meta: {
    name: "generate",
    description:
      "Check eligible pages by offset and run generate job for each page",
  },
  async run() {
    const { voteIntervalMinutes } = useAppConfig();
    const offset = Math.floor((Date.now() / 1000 / 60) % voteIntervalMinutes);
    const pages = await db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(eq(schema.pages.offset, offset));

    console.info(
      `Found ${pages.length} pages to process with offset ${offset}`,
    );
    await Promise.allSettled(pages.map((page) => generateForPage(page.id)));

    return {
      result: {
        offset,
        processed: pages.length,
      },
    };
  },
});
