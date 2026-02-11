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

  const { user } = await requireUserSession(event);
  const storage = useStorage();

  const body = await readBody(event);
  const prompts = await db
    .insert(schema.prompts)
    .values({
      page_id: page_id,
      user_id: user.id,
      content: body.content,
      created_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.prompts.page_id, schema.prompts.user_id],
      targetWhere: eq(schema.prompts.pending, true),
      set: { content: body.content, created_at: new Date() },
    })
    .returning();

  const prompt = prompts[0];
  if (prompt) {
    storage.setItem(`pages:${page_id}:prompts:${prompt.id}`, {
      content: prompt.content,
    });
  }
  return [];
});
