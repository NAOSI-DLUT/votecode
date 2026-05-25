import { db, schema } from "@nuxthub/db";
import { eq } from "drizzle-orm";
import type { Message } from "xsai";
import { rawTool, streamText } from "xsai";

export async function generate(promptId: number) {
  const storage = useStorage();
  console.info("[generate] start", { promptId });
  const prompt = await db.query.prompts.findFirst({
    where: eq(schema.prompts.id, promptId),
  });
  if (!prompt) {
    throw createError({ statusCode: 404, statusMessage: "Prompt not found" });
  }
  await db
    .update(schema.prompts)
    .set({ generating: true, response: null })
    .where(eq(schema.prompts.id, prompt.id));

  const parent = prompt.parent
    ? await db.query.prompts.findFirst({ where: eq(schema.prompts.id, prompt.parent) })
    : null;

  let latestHtml = parent?.html ?? "";
  console.info("[generate] prompt context", {
    promptId: prompt.id,
    pageId: prompt.pageId,
    parentId: prompt.parent ?? null,
    parentHtmlLength: parent?.html?.length ?? 0,
    initialHtmlLength: latestHtml.length,
    promptLength: prompt.content.length,
  });
  await storage.setItem(`html:${prompt.id}`, latestHtml);
  await storage.setItem(`pages:${prompt.pageId}`, {
    id: prompt.id,
    generating: true,
    response: null,
  });

  const readHtmlTool = rawTool({
    name: "read_html",
    description: "Read current complete HTML content",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    execute: async () => latestHtml,
  });

  const replaceHtmlTool = rawTool<{
    pattern: string;
    replacement: string;
    regex?: boolean;
    flags?: string;
  }>({
    name: "replace_html",
    description: "Replace HTML content by plain string or regex and persist the updated full HTML",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        replacement: { type: "string" },
        regex: { type: "boolean" },
        flags: { type: "string" },
      },
      required: ["pattern", "replacement"],
      additionalProperties: false,
    },
    execute: async ({ pattern, replacement, regex = false, flags = "g" }) => {
      if (!pattern) {
        throw createError({ statusCode: 400, statusMessage: "pattern is required" });
      }

      const beforeLength = latestHtml.length;
      if (regex) {
        let regExp: RegExp;
        try {
          regExp = new RegExp(pattern, flags);
        } catch {
          throw createError({ statusCode: 400, statusMessage: "Invalid regex pattern or flags" });
        }
        latestHtml = latestHtml.replace(regExp, replacement);
      } else {
        latestHtml = latestHtml.split(pattern).join(replacement);
      }
      const afterLength = latestHtml.length;
      console.info("[generate] html updated", {
        promptId: prompt.id,
        mode: regex ? "regex" : "plain",
        beforeLength,
        afterLength,
        changed: beforeLength !== afterLength || pattern !== replacement,
      });

      await storage.setItem(`html:${prompt.id}`, latestHtml);
      return "ok";
    },
  });

  const result = streamText({
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: process.env.OPENAI_BASE_URL!,
    model: process.env.OPENAI_MODEL!,
    messages: [
      {
        role: "system",
        content:
          "You are a web programming assistant. Use tools to read and edit HTML. Call read_html once before editing. Use replace_html for targeted edits; prefer regex with precise patterns when useful. Keep tool calls minimal. In final answer, return only your user-facing response text.",
      },
      { role: "user", content: prompt.content },
    ] as Message[],
    maxSteps: 10,
    tools: [readHtmlTool, replaceHtmlTool],
  });

  let responseText = "";
  for await (const event of result.fullStream as any) {
    if (event.type === "text-delta") {
      responseText += event.text;
      await storage.setItem(`pages:${prompt.pageId}`, {
        id: prompt.id,
        response: responseText,
      });
    }
  }

  try {
    console.info("[generate] stream completed", {
      promptId: prompt.id,
      responseLength: responseText.trim().length,
      finalHtmlLength: latestHtml.length,
      htmlEmpty: latestHtml.trim().length === 0,
    });
    if (!responseText.trim()) {
      throw createError({ statusCode: 500, statusMessage: "Model returned empty response" });
    }

    await db
      .update(schema.prompts)
      .set({ response: responseText.trim(), html: latestHtml, generating: false })
      .where(eq(schema.prompts.id, prompt.id));

    await storage.setItem(`pages:${prompt.pageId}`, {
      id: prompt.id,
      response: responseText.trim(),
      generating: false,
    });
    console.info("[generate] success", { promptId: prompt.id });
  } catch (error: any) {
    console.info("[generate] failed", {
      promptId: prompt.id,
      responseLength: responseText.trim().length,
      finalHtmlLength: latestHtml.length,
      error: error?.statusMessage || error?.message || "Generation failed",
    });
    await db
      .update(schema.prompts)
      .set({
        generating: false,
        response:
          responseText.trim() ||
          error?.statusMessage ||
          error?.message ||
          "Generation failed",
      })
      .where(eq(schema.prompts.id, prompt.id));
    await storage.setItem(`pages:${prompt.pageId}`, {
      id: prompt.id,
      generating: false,
      response:
        responseText.trim() ||
        error?.statusMessage ||
        error?.message ||
        "Generation failed",
    });
    throw error;
  }
}
