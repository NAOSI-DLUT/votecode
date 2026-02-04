import { db, schema } from "@nuxthub/db";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { page_id } = getRouterParams(event);
  if (!page_id) {
    throw createError({
      statusCode: 400,
      statusMessage: "page_id is required",
    });
  }
  return await db
    .select()
    .from(schema.prompts)
    .where(eq(schema.prompts.page_id, page_id))
    .leftJoin(schema.users, eq(schema.prompts.user_id, schema.users.id));
});
