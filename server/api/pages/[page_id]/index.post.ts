import { db, schema } from "@nuxthub/db";
import { createHash } from "crypto";

export default defineEventHandler(async (event) => {
  await requireUserSession(event);
  const { page_id: rawPageId } = getRouterParams(event);
  const page_id = rawPageId?.trim().toLowerCase();
  if (!page_id) {
    throw createError({
      statusCode: 400,
      statusMessage: "page_id is required",
    });
  }
  if (!/^[a-z_-]+$/.test(page_id)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "page_id can only contain lowercase letters, hyphens, and underscores",
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
