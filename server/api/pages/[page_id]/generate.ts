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
import { generateText, Message, tool } from "xsai";
import { z } from "zod";

export default defineEventHandler(async (event) => {
  const { page_id } = getRouterParams(event);
  if (!page_id) {
    throw createError({
      statusCode: 400,
      statusMessage: "page_id is required",
    });
  }

  const { voteIntervalMinutes } = useAppConfig();
  const lastVoteTime = new Date(
    Math.floor(Date.now() / 1000 / (voteIntervalMinutes * 60)) *
      (voteIntervalMinutes * 60) *
      1000,
  );

  const readHtml = await tool({
    name: "readHtml",
    description: "Read the full HTML code",
    parameters: z.object({}),
    execute: async () => {
      return await db.query.pages.findFirst({
        where: eq(schema.pages.id, page_id),
      });
    },
  });

  const writeHtml = await tool({
    name: "writeHtml",
    description: "Write the full HTML code",
    parameters: z.object({
      html: z.string().describe("The full HTML code to write to the page"),
    }),
    execute: async ({ html }) => {
      return await db
        .update(schema.pages)
        .set({ html })
        .where(eq(schema.pages.id, page_id));
    },
  });

  return db.transaction(async (tx) => {
    const lockResult = await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(hashtext(${page_id})) as lock`,
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
          eq(schema.prompts.page_id, page_id),
          eq(schema.prompts.pending, true),
          lte(schema.prompts.created_at, lastVoteTime),
        ),
      )
      .leftJoin(schema.votes, eq(schema.prompts.id, schema.votes.prompt_id))
      .groupBy(schema.prompts.id);

    if (!pendingPrompts[0]) {
      throw createError({
        statusCode: 404,
        statusMessage: "No pending prompts found",
      });
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
          eq(schema.prompts.page_id, page_id),
          isNotNull(schema.prompts.response),
        ),
      )
      .orderBy(desc(schema.prompts.created_at))
      .limit(5);

    const res = await generateText({
      apiKey: process.env.OPENAI_API_KEY!,
      baseURL: process.env.OPENAI_BASE_URL!,
      model: process.env.OPENAI_MODEL!,
      tools: [readHtml, writeHtml],
      maxSteps: 3,
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

    if (!res.text) {
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to generate text",
      });
    }

    await tx
      .update(schema.prompts)
      .set({ pending: false })
      .where(
        and(
          eq(schema.prompts.page_id, page_id),
          eq(schema.prompts.pending, true),
          lte(schema.prompts.created_at, lastVoteTime),
        ),
      );

    await tx
      .update(schema.prompts)
      .set({ response: res.text })
      .where(eq(schema.prompts.id, bestPrompt.id));

    return res;
  });
});
