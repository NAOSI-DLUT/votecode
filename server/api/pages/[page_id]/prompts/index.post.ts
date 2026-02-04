import { db, schema } from "@nuxthub/db";
import { isNull } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { page_id } = getRouterParams(event);
  if (!page_id) {
    throw createError({
      statusCode: 400,
      statusMessage: "page_id is required",
    });
  }

  const { user } = await getUserSession(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const body = await readBody(event);
  return await db
    .insert(schema.prompts)
    .values({
      page_id: page_id,
      user_id: user.id,
      content: body.content,
      created_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.prompts.page_id, schema.prompts.user_id],
      targetWhere: isNull(schema.prompts.response),
      set: { content: body.content, created_at: new Date() },
    });
});
