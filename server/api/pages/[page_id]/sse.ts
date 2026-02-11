import { db } from "@nuxthub/db";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const { page_id } = getRouterParams(event);
  const storage = useStorage();
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

  const eventStream = createEventStream(event);
  const unwatch = await storage.watch(async (event, key) => {
    console.log("sse got", event, key, await storage.getItem(key));

    if (key?.startsWith(`pages:${page_id}:`)) {
      eventStream.push(
        JSON.stringify({ event, key, value: await storage.getItem(key) }),
      );
    }
  });
  eventStream.onClosed(unwatch);
  return eventStream.send();
});
