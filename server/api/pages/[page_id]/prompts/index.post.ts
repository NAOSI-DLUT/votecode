import { db, schema } from "@nuxthub/db";
import { eq } from "drizzle-orm";
import { generate } from "../../../../utils/generate";

export default defineEventHandler(async (event) => {
  const { page_id } = getRouterParams(event);
  if (!page_id) {
    throw createError({
      statusCode: 400,
      statusMessage: "page_id is required",
    });
  }

  const { user } = await requireUserSession(event);

  const body = await readBody(event);
  const page = await db.query.pages.findFirst({
    where: eq(schema.pages.id, page_id),
  });
  if (!page) {
    throw createError({
      statusCode: 404,
      statusMessage: "Page not found",
    });
  }

  const inserted = await db
    .insert(schema.prompts)
    .values({
      pageId: page_id,
      userId: user.id,
      parent: page.latestPrompt,
      content: body.content,
      createdAt: new Date(),
      html: "",
    })
    .returning();

  const prompt = inserted[0];
  if (!prompt) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create prompt",
    });
  }

  event.waitUntil?.(generate(prompt.id));
  await useStorage().setItem(`pages:${page_id}:refresh`, true);
  return { ok: true, promptId: prompt.id };
});
