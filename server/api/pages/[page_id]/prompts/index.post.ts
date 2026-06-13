import { db, schema } from "@nuxthub/db";
import { eq, sql } from "drizzle-orm";
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

  const nextIdRows = await db
    .select({ id: sql<number>`coalesce(max(${schema.prompts.id}), 0) + 1` })
    .from(schema.prompts)
    .where(eq(schema.prompts.pageId, page_id));
  const promptId = Number(nextIdRows[0]?.id ?? 1);

  const inserted = await db
    .insert(schema.prompts)
    .values({
      id: promptId,
      pageId: page_id,
      userId: user.id,
      parent: page.latestPrompt,
      content: body.content,
      createdAt: new Date(),
      html: "",
      status: "pending",
    })
    .returning();

  const prompt = inserted[0];
  if (!prompt) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create prompt",
    });
  }

  await useStorage().setItem(`pages:${page_id}`, {
    ...prompt,
    user: {
      id: user.id,
      name: user.name,
      avatar_url: user.avatar_url,
    },
    voteCount: 0,
    voted: false,
  });
  event.waitUntil?.(generate(page_id, prompt.id));
  return { ok: true, promptId: prompt.id };
});
