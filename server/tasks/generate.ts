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
import { Message, streamObject, toAsyncIterator } from "xsai";
import { z } from "zod";

const generateOutputSchema = z.object({
  response: z.string().describe("The assistant's reply to the user"),
  html: z
    .string()
    .optional()
    .describe("The complete updated HTML content of the page"),
});

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
  pageHtml: string,
  content: string,
  historyPrompts: any[],
) {
  const { partialObjectStream } = await streamObject({
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: process.env.OPENAI_BASE_URL!,
    model: process.env.OPENAI_MODEL!,
    messages: [
      {
        role: "system",
        content:
          "You are a web programming assistant. Based on the user's requirements, make the necessary modifications, and then output the complete updated HTML content of the page along with your response.",
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
        content: JSON.stringify({
          html: pageHtml,
          content,
        }),
      },
    ],
    schema: generateOutputSchema,
  });

  let finalChunk: z.infer<typeof generateOutputSchema> | undefined;
  for await (const chunk of toAsyncIterator(partialObjectStream)) {
    finalChunk = chunk as z.infer<typeof generateOutputSchema>;
  }

  if (!finalChunk?.response) {
    throw createError({
      statusCode: 500,
      statusMessage: "Model returned empty response",
    });
  }

  return finalChunk;
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
      page.html,
      bestPrompt.content,
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
