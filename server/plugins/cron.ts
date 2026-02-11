import { db, schema } from "@nuxthub/db";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  isNotNull,
  lte,
  sql,
} from "drizzle-orm";
import { CronJob } from "cron";
import { Message, streamText, toAsyncIterator, tool } from "xsai";
import { z } from "zod";

async function generate(pageId: string) {
  const storage = useStorage();
  const readHtml = await tool({
    name: "readHtml",
    description: "Read the full HTML code",
    parameters: z.object({}),
    execute: async () => {
      return await db.query.pages.findFirst({
        where: eq(schema.pages.id, pageId),
      });
    },
  });

  const writeHtml = await tool({
    name: "writeHtml",
    description: "Write the full HTML code",
    parameters: z.string().describe("The full HTML code to write to the page"),
    execute: async (html) => {
      return await db
        .update(schema.pages)
        .set({ html })
        .where(eq(schema.pages.id, pageId));
    },
  });

  return await db.transaction(async (tx) => {
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

    const pendingPrompts = await tx
      .select({
        ...getTableColumns(schema.prompts),
        voteCount: count(schema.votes),
      })
      .from(schema.prompts)
      .where(
        and(
          eq(schema.prompts.page_id, pageId),
          eq(schema.prompts.pending, true),
        ),
      )
      .leftJoin(schema.votes, eq(schema.prompts.id, schema.votes.prompt_id))
      .groupBy(schema.prompts.id);

    if (!pendingPrompts[0]) {
      return;
    }

    const bestPrompt = pendingPrompts.reduce((max, prompt) => {
      return prompt.voteCount > max.voteCount ? prompt : max;
    }, pendingPrompts[0]);

    const historyPrompts = await tx
      .select({
        user_id: schema.prompts.user_id,
        content: schema.prompts.content,
        response: schema.prompts.response,
      })
      .from(schema.prompts)
      .where(
        and(
          eq(schema.prompts.page_id, pageId),
          isNotNull(schema.prompts.response),
        ),
      )
      .orderBy(desc(schema.prompts.created_at))
      .limit(5);

    const { textStream, fullStream } = streamText({
      apiKey: process.env.OPENAI_API_KEY!,
      baseURL: process.env.OPENAI_BASE_URL!,
      model: process.env.OPENAI_MODEL!,
      tools: [readHtml, writeHtml],
      maxSteps: 5,
      messages: [
        {
          role: "system",
          content: `You are a web programming assistant. Based on the user's requirements, use the "readHtml" tool to read the HTML content, make the necessary modifications, and then use the "writeHtml" tool to write the updated complete HTML back. Finally, reply to the user with the modifications you have made.`,
        },
        ...(historyPrompts
          .reverse()
          .map((msg) => [
            {
              role: "user",
              content: msg.content,
            },
            {
              role: "assistant",
              content: msg.response,
            },
          ])
          .flat() as Message[]),
        {
          role: "user",
          content: bestPrompt.content,
        },
      ],
    });
    const htmlChunks: string[] = [];
    const textChunks: string[] = [];
    for await (const chunk of toAsyncIterator(fullStream)) {
      if (chunk.type === "tool-call-delta") {
        htmlChunks.push(chunk.argsTextDelta);
        storage.setItem(`pages:${pageId}:html`, htmlChunks.join(""));
      } else if (chunk.type === "text-delta") {
        textChunks.push(chunk.text);
        storage.setItem(`pages:${pageId}:prompts:${bestPrompt.id}`, {
          response: textChunks.join(""),
        });
      }
    }

    await tx
      .update(schema.prompts)
      .set({ pending: false })
      .where(
        and(
          eq(schema.prompts.page_id, pageId),
          eq(schema.prompts.pending, true),
        ),
      );

    await tx
      .update(schema.prompts)
      .set({ response: textChunks.join("") })
      .where(eq(schema.prompts.id, bestPrompt.id));
  });
}

export default defineNitroPlugin((nitroApp) => {
  const { voteIntervalMinutes } = useAppConfig();
  const job = new CronJob("*/10 * * * * *", async () => {
    const offset = Math.floor((Date.now() / 1000 / 60) % voteIntervalMinutes);
    const pages = await db.select({ id: schema.pages.id }).from(schema.pages);
    // .where(eq(schema.pages.offset, offset));
    console.log(`offset: ${offset}, pages: ${pages.length}`);

    await Promise.allSettled(
      pages.map(async (page) => {
        await generate(page.id);
      }),
    );
  });
  job.start();
});
