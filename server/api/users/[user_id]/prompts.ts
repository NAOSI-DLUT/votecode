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

  const userId = Number(user_id);
  if (!Number.isInteger(userId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid user_id",
    });
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });
  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found",
    });
  }

  return await db
    .select()
    .from(schema.prompts)
    .where(eq(schema.prompts.userId, userId))
    .orderBy(desc(schema.prompts.createdAt));
});
