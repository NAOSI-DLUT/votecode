import { db, schema } from "@nuxthub/db";
import { desc, eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { user_id } = getRouterParams(event);
  if (!user_id) {
    throw createError({
      statusCode: 400,
      statusMessage: "user_id is required",
    });
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, user_id),
  });
  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found",
    });
  }

  const prompts = await db
    .select()
    .from(schema.prompts)
    .where(eq(schema.prompts.userId, user_id))
    .orderBy(desc(schema.prompts.createdAt));

  return { user, prompts };
});
