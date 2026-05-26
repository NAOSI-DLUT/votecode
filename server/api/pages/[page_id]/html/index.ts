import { db, schema } from "@nuxthub/db";
import { and, eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { page_id } = getRouterParams(event);
  if (!page_id) {
    throw createError({
      statusCode: 400,
      statusMessage: "page_id is required",
    });
  }

  const page = await db.query.pages.findFirst({
    where: eq(schema.pages.id, page_id),
  });
  if (!page) {
    throw createError({
      statusCode: 404,
      statusMessage: "Page not found",
    });
  }
  if (page.latestPrompt == null) {
    setHeader(event, "content-type", "text/html; charset=utf-8");
    return "";
  }

  const prompt = await db.query.prompts.findFirst({
    where: and(
      eq(schema.prompts.pageId, page_id),
      eq(schema.prompts.id, page.latestPrompt),
    ),
  });

  setHeader(event, "content-type", "text/html; charset=utf-8");
  return prompt?.html || "";
});
