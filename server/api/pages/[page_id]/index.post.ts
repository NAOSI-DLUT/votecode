import { db, schema } from "@nuxthub/db";
import { createHash } from "crypto";

export default defineEventHandler(async (event) => {
  const { page_id } = getRouterParams(event);
  if (!page_id) {
    throw createError({
      statusCode: 400,
      statusMessage: "page_id is required",
    });
  }
  const { voteIntervalMinutes } = useAppConfig();
  const offset =
    createHash("md5").update(page_id).digest("hex").charCodeAt(15) %
      voteIntervalMinutes || 0;
  return await db
    .insert(schema.pages)
    .values({ id: page_id, offset })
    .returning()
    .onConflictDoNothing();
});
