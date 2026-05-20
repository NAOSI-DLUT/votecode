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
    name: "write_html_range",
    description: "Replace a line range in HTML and persist the updated full HTML",
    parameters: {
      type: "object",
      properties: {
        startLine: {
          type: "number",
          description: "1-based start line (inclusive)",
        },
        endLine: {
          type: "number",
          description: "1-based end line (inclusive)",
        },
        newLines: {
          type: "array",
          description: "Replacement lines without trailing newline characters",
          items: {
            type: "string",
          },
        },
      },
      required: ["startLine", "endLine", "newLines"],
      additionalProperties: false,
    },
    execute: async ({ startLine, endLine, newLines }) => {
      const lines = latestHtml.split("\n");
      if (
        startLine < 1 ||
        endLine < startLine ||
        endLine > lines.length ||
        !Array.isArray(newLines)
      ) {
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid write_html_range line range",
        });
      }

      lines.splice(startLine - 1, endLine - startLine + 1, ...newLines);
      latestHtml = lines.join("\n");
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
          "You are a web programming assistant. Use tools to read and edit HTML. Call read_html once before editing. Use write_html_range to edit only the needed lines (1-based inclusive range with newLines). Never send full HTML to a write tool. Keep tool calls minimal. In final answer, return only your user-facing response text.",
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

  for await (const event of result.fullStream as any) {
    if (event.type === "text-delta") {
      responseText += event.text;
      await storage.setItem(`pages:${pageId}:prompts:${bestPrompt.id}`, {
        response: responseText,
      });
      continue;
    }
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
