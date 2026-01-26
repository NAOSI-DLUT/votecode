import { db, schema } from "@nuxthub/db";
import { and, eq, isNull } from "drizzle-orm";

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
  const existingPrompt = await db
    .select({ id: schema.prompts.id })
    .from(schema.prompts)
    .where(
      and(
        eq(schema.prompts.page_id, page_id),
        eq(schema.prompts.user_id, user.id),
        isNull(schema.prompts.response),
      ),
    )
    .limit(1);
  if (existingPrompt[0]) {
    return await db
      .update(schema.prompts)
      .set({
        content: body.content,
        created_at: new Date(),
      })
      .where(eq(schema.prompts.id, existingPrompt[0].id));
  } else {
    setResponseStatus(event, 201);
    return await db.insert(schema.prompts).values({
      page_id: page_id,
      user_id: user.id,
      content: body.content,
    });
  }
});
