import { db, schema } from "@nuxthub/db";
import { and, eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { page_id, prompt_id } = getRouterParams(event);
  if (!page_id || !prompt_id) {
    throw createError({
      statusCode: 400,
      statusMessage: "page_id and prompt_id are required",
    });
  }

  const prompt = await db.query.prompts.findFirst({
    where: and(
      eq(schema.prompts.pageId, page_id),
      eq(schema.prompts.id, Number(prompt_id)),
    ),
  });
  if (!prompt) {
    throw createError({
      statusCode: 404,
      statusMessage: "Prompt not found",
    });
  }

  setHeader(event, "content-type", "text/html; charset=utf-8");
  return prompt.html;
});
