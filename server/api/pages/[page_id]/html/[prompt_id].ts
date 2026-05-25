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

  const parent = prompt.parent
    ? await db.query.prompts.findFirst({
        where: eq(schema.prompts.id, prompt.parent),
      })
    : null;

  const storage = useStorage();
  const promptKey = `pages:${page_id}`;
  const htmlKey = `html:${prompt.id}`;
  if (!prompt.generating) {
    setHeader(event, "content-type", "text/html; charset=utf-8");
    return prompt.html;
  }

  const initialHtml =
    ((await storage.getItem<string>(htmlKey)) as string | null) ??
    (prompt.html || parent?.html || "");

  const eventStream = createEventStream(event);
  let closed = false;
  let unwatch: (() => void | Promise<void>) | undefined;

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    await unwatch?.();
  };
  const toSseData = (html: string) => html.split(/\r?\n/).join("\ndata: ");
  const push = async (html: string) => {
    if (closed) return;
    await eventStream.push(toSseData(html));
  };

  eventStream.onClosed(cleanup);
  await push(initialHtml);

  unwatch = await storage.watch(async (_watchEvent, key) => {
    if (key === htmlKey) {
      await push(((await storage.getItem<string>(htmlKey)) as string | null) ?? "");
      return;
    }

    if (key !== promptKey) {
      return;
    }

    const nextPrompt = await storage.getItem<{ id?: number; generating?: boolean }>(
      promptKey,
    );
    if (nextPrompt?.id !== prompt.id || nextPrompt.generating !== false) {
      return;
    }

    await push(((await storage.getItem<string>(htmlKey)) as string | null) ?? "");
    await cleanup();
    await eventStream.close();
  });

  return eventStream.send();
});
