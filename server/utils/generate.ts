import { db, schema } from "@nuxthub/db";
import { and, eq } from "drizzle-orm";
import type { Message } from "xsai";
import { rawTool, streamText } from "xsai";

export async function generate(pageId: string, promptId: number) {
  const storage = useStorage();
  const maxSteps = 10;
  let currentStep = 1;
  let responseText = "";

  const prompt = await db.query.prompts.findFirst({
    where: and(
      eq(schema.prompts.pageId, pageId),
      eq(schema.prompts.id, promptId),
    ),
  });
  if (!prompt) {
    throw createError({ statusCode: 404, statusMessage: "Prompt not found" });
  }
  console.info(`[generate] start pageId=${prompt.pageId} promptId=${prompt.id}`);

  const parent = prompt.parent
    ? await db.query.prompts.findFirst({
        where: and(
          eq(schema.prompts.pageId, prompt.pageId),
          eq(schema.prompts.id, prompt.parent),
        ),
      })
    : null;
  let latestHtml = prompt.html || parent?.html || "";

  await db
    .update(schema.prompts)
    .set({ response: null, html: latestHtml })
    .where(
      and(
        eq(schema.prompts.pageId, prompt.pageId),
        eq(schema.prompts.id, prompt.id),
      ),
    );
  await storage.setItem(`pages:${prompt.pageId}`, {
    id: prompt.id,
    response: null,
    refresh: true,
  });

  const readHtmlTool = rawTool({
    name: "read_html",
    description: "Read current complete HTML content",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => latestHtml,
  });

  const writeHtmlTool = rawTool<{
    html: string;
  }>({
    name: "write_html",
    description:
      "Replace the entire HTML document and persist it. Use this when the current HTML is empty, when creating a page from scratch, or when a broad rewrite is simpler than an exact replacement.",
    parameters: {
      type: "object",
      properties: {
        html: { type: "string" },
      },
      required: ["html"],
      additionalProperties: false,
    },
    execute: async ({ html }) => {
      const step = `${Math.min(currentStep, maxSteps)}/${maxSteps}`;
      const beforeHtml = latestHtml;
      latestHtml = html || "";
      await db
        .update(schema.prompts)
        .set({ html: latestHtml })
        .where(
          and(
            eq(schema.prompts.pageId, prompt.pageId),
            eq(schema.prompts.id, prompt.id),
          ),
        );
      await storage.setItem(`pages:${prompt.pageId}`, {
        id: prompt.id,
        refresh: true,
      });
      console.info(
        `[generate] write_html tool pageId=${prompt.pageId} promptId=${prompt.id} step=${step} beforeLength=${beforeHtml.length} afterLength=${latestHtml.length} changed=${latestHtml !== beforeHtml} result=changed`,
      );
      return "changed";
    },
  });

  const replaceHtmlTool = rawTool<{
    pattern?: string;
    replacement?: string;
  }>({
    name: "replace_html",
    description:
      "Replace exact text in the current HTML and persist it. No regex. Use read_html first, then provide an exact pattern and replacement. If the page is empty or a full rewrite is needed, use write_html instead.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        replacement: { type: "string" },
      },
      required: ["pattern", "replacement"],
      additionalProperties: false,
    },
    execute: async ({ pattern = "", replacement = "" }) => {
      const step = `${Math.min(currentStep, maxSteps)}/${maxSteps}`;
      const beforeHtml = latestHtml;

      if (!pattern) {
        console.info(
          `[generate] replace_html tool pageId=${prompt.pageId} promptId=${prompt.id} step=${step} beforeLength=${beforeHtml.length} afterLength=${latestHtml.length} changed=false result=missing_pattern`,
        );
        return "missing_pattern: HTML unchanged. replace_html requires an exact pattern. Use write_html to replace the full document.";
      }

      if (!latestHtml.includes(pattern)) {
        console.info(
          `[generate] replace_html tool pageId=${prompt.pageId} promptId=${prompt.id} step=${step} beforeLength=${beforeHtml.length} afterLength=${latestHtml.length} changed=false result=target_not_found`,
        );
        return "target_not_found: HTML unchanged. Call read_html to inspect current HTML, or use write_html to replace the full document.";
      }

      latestHtml = latestHtml.split(pattern).join(replacement);
      await db
        .update(schema.prompts)
        .set({ html: latestHtml })
        .where(
          and(
            eq(schema.prompts.pageId, prompt.pageId),
            eq(schema.prompts.id, prompt.id),
          ),
        );
      await storage.setItem(`pages:${prompt.pageId}`, {
        id: prompt.id,
        refresh: true,
      });
      console.info(
        `[generate] replace_html tool pageId=${prompt.pageId} promptId=${prompt.id} step=${step} beforeLength=${beforeHtml.length} afterLength=${latestHtml.length} changed=${latestHtml !== beforeHtml} result=changed`,
      );
      return "changed";
    },
  });

  try {
    const result = streamText({
      apiKey: process.env.OPENAI_API_KEY!,
      baseURL: process.env.OPENAI_BASE_URL!,
      model: process.env.OPENAI_MODEL!,
      messages: [
        {
          role: "system",
          content:
            "You are votecode, a collaborative web programming assistant. Before any tool call, first send a brief one-sentence progress update to the user. Then use tools to read and edit HTML. Call read_html before editing. Use write_html when the current HTML is empty, when creating a page from scratch, or when making broad changes. Use replace_html only for exact text replacements; it requires both pattern and replacement and does not support regex. If replace_html returns missing_pattern or target_not_found, call read_html again or use write_html. Keep tool calls minimal. In final answer, return only your user-facing response text.",
        },
        { role: "user", content: prompt.content },
      ] as Message[],
      maxSteps,
      onStepFinish: () => {
        currentStep += 1;
      },
      tools: [readHtmlTool, writeHtmlTool, replaceHtmlTool],
    });

    for await (const event of result.fullStream as any) {
      if (event.type === "text-delta") {
        responseText += event.text;
        await storage.setItem(`pages:${prompt.pageId}`, {
          id: prompt.id,
          response: responseText,
        });
      }
    }

    if (!responseText.trim()) {
      throw createError({
        statusCode: 500,
        statusMessage: "Model returned empty response",
      });
    }

    await db
      .update(schema.prompts)
      .set({ response: responseText.trim(), html: latestHtml })
      .where(
        and(
          eq(schema.prompts.pageId, prompt.pageId),
          eq(schema.prompts.id, prompt.id),
        ),
      );

    await storage.setItem(`pages:${prompt.pageId}`, {
      id: prompt.id,
      response: responseText.trim(),
    });

    console.info(
      `[generate] success pageId=${prompt.pageId} promptId=${prompt.id} responseLength=${responseText.trim().length} finalHtmlLength=${latestHtml.length}`,
    );
  } catch (error: any) {
    const response =
      responseText.trim() ||
      error?.statusMessage ||
      error?.message ||
      "Generation failed";
    console.error(
      `[generate] failed pageId=${prompt.pageId} promptId=${prompt.id} responseLength=${responseText.trim().length} finalHtmlLength=${latestHtml.length} error=${error?.statusMessage || error?.message || "Generation failed"}`,
    );
    await db
      .update(schema.prompts)
      .set({ response, html: latestHtml })
      .where(
        and(
          eq(schema.prompts.pageId, prompt.pageId),
          eq(schema.prompts.id, prompt.id),
        ),
      );
    await storage.setItem(`pages:${prompt.pageId}`, {
      id: prompt.id,
      response,
    });

    throw error;
  }
}
