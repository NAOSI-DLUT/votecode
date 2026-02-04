import { db, schema } from "@nuxthub/db";

export default defineEventHandler(async (event) => {
  const { page_id } = getRouterParams(event);
  if (!page_id) {
    throw createError({
      statusCode: 400,
      statusMessage: "page_id is required",
    });
  }
  return await db
    .insert(schema.pages)
    .values({ id: page_id })
    .returning()
    .onConflictDoNothing();
});
