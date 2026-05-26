import { db, schema } from "@nuxthub/db";
import { and, count, eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { page_id, prompt_id } = getRouterParams(event);
  if (!page_id || !prompt_id) {
    throw createError({
      statusCode: 400,
      statusMessage: "page_id and prompt_id are required",
    });
  }

  const { user } = await requireUserSession(event);
  const body = await readBody(event);
  const promptId = Number(prompt_id);
  const prompt = await db.query.prompts.findFirst({
    where: and(eq(schema.prompts.pageId, page_id), eq(schema.prompts.id, promptId)),
  });
  if (!prompt) {
    throw createError({
      statusCode: 404,
      statusMessage: "Prompt not found",
    });
  }

  const result = body.vote
    ? await db
        .insert(schema.votes)
        .values({
          pageId: page_id,
          promptId,
          userId: user.id,
        })
        .onConflictDoNothing()
    : await db
        .delete(schema.votes)
        .where(
          and(
            eq(schema.votes.pageId, page_id),
            eq(schema.votes.promptId, promptId),
            eq(schema.votes.userId, user.id),
          ),
        );

  const rows = await db
    .select({ voteCount: count(schema.votes) })
    .from(schema.votes)
    .where(and(eq(schema.votes.pageId, page_id), eq(schema.votes.promptId, promptId)));

  await useStorage().setItem(`pages:${page_id}`, {
    id: promptId,
    voteCount: rows[0]?.voteCount ?? 0,
  });

  return result;
});
