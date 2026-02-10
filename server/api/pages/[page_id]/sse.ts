import { db } from "@nuxthub/db";
import { eq } from "drizzle-orm";

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

  const eventStream = createEventStream(event);
  const unwatch = await useStorage().watch((event, key) => {
    if (key?.startsWith(`pages:${page_id}:`)) {
      eventStream.push(
        JSON.stringify({ event, key, value: useStorage().getItem(key) }),
      );
    }
  });
  eventStream.onClosed(() => {
    unwatch();
    eventStream.close();
  });
  return eventStream.send();
});
