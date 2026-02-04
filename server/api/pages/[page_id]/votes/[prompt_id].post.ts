import { db, schema } from "@nuxthub/db";
import { and, eq } from "drizzle-orm";

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
  if (body.vote) {
    return await db
      .insert(schema.votes)
      .values({
        prompt_id: Number(prompt_id),
        user_id: user.id,
      })
      .onConflictDoNothing();
  } else {
    return await db
      .delete(schema.votes)
      .where(
        and(
          eq(schema.votes.prompt_id, Number(prompt_id)),
          eq(schema.votes.user_id, user.id),
        ),
      );
  }
});
