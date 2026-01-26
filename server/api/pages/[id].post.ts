import { db, schema } from "@nuxthub/db";

export default defineEventHandler(async (event) => {
  const { id } = getRouterParams(event);
  if (id) {
    return await db
      .insert(schema.pages)
      .values({ id })
      .returning()
      .onConflictDoNothing();
  } else {
    throw new Error("Page ID is required");
  }
});
