import { db, schema } from "@nuxthub/db";
import { eq } from "drizzle-orm";
import type { Message } from "xsai";
import { rawTool, streamText } from "xsai";

export async function generate(promptId: number) {
  const storage = useStorage();
  const maxSteps = 10;
  let currentStep = 1;
  let responseText = "";

  const prompt = await db.query.prompts.findFirst({
    where: eq(schema.prompts.id, promptId),
  });
  if (!prompt) {
    throw createError({ statusCode: 404, statusMessage: "Prompt not found" });
  }
  console.info("[generate] start", {
    pageId: prompt.pageId,
    promptId: prompt.id,
  });

  const parent = prompt.parent
    ? await db.query.prompts.findFirst({ where: eq(schema.prompts.id, prompt.parent) })
    : null;
  let latestHtml = prompt.html || parent?.html || "";

  await db
    .update(schema.prompts)
    .set({ response: null, html: latestHtml })
    .where(eq(schema.prompts.id, prompt.id));
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
      const step = `${Math.min(currentStep, maxSteps)}/${maxSteps}`;
      const mode = regex ? "regex" : "plain";
      if (!pattern) {
        console.error("[generate] replace_html failed", {
          pageId: prompt.pageId,
          promptId: prompt.id,
          step,
          mode,
          error: "pattern is required",
        });
        throw createError({ statusCode: 400, statusMessage: "pattern is required" });
      }

      const beforeHtml = latestHtml;
      const beforeLength = beforeHtml.length;
      if (regex) {
        let regExp: RegExp;
        try {
          regExp = new RegExp(pattern, flags);
        } catch {
          console.error("[generate] replace_html failed", {
            pageId: prompt.pageId,
            promptId: prompt.id,
            step,
            mode,
            flags,
            error: "Invalid regex pattern or flags",
          });
          throw createError({
            statusCode: 400,
            statusMessage: "Invalid regex pattern or flags",
          });
        }
        latestHtml = latestHtml.replace(regExp, replacement);
      } else {
        latestHtml = latestHtml.split(pattern).join(replacement);
      }
      const afterLength = latestHtml.length;
      const changed = latestHtml !== beforeHtml;

      await db
        .update(schema.prompts)
        .set({ html: latestHtml })
        .where(eq(schema.prompts.id, prompt.id));
      await storage.setItem(`pages:${prompt.pageId}`, {
        id: prompt.id,
        refresh: true,
      });
      console.info("[generate] replace_html", {
        pageId: prompt.pageId,
        promptId: prompt.id,
        step,
        mode,
        ...(regex ? { flags } : {}),
        beforeLength,
        afterLength,
        changed,
        result: changed ? "changed" : "unchanged",
      });
      return "ok";
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
            "You are a web programming assistant. Use tools to read and edit HTML. Call read_html once before editing. Use replace_html for targeted edits; prefer regex with precise patterns when useful. Keep tool calls minimal. In final answer, return only your user-facing response text.",
        },
        { role: "user", content: prompt.content },
      ] as Message[],
      maxSteps,
      onStepFinish: () => {
        currentStep += 1;
      },
      tools: [readHtmlTool, replaceHtmlTool],
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
      throw createError({ statusCode: 500, statusMessage: "Model returned empty response" });
    }

    await db
      .update(schema.prompts)
      .set({ response: responseText.trim(), html: latestHtml })
      .where(eq(schema.prompts.id, prompt.id));

    await storage.setItem(`pages:${prompt.pageId}`, {
      id: prompt.id,
      response: responseText.trim(),
    });

    console.info("[generate] success", {
      pageId: prompt.pageId,
      promptId: prompt.id,
      responseLength: responseText.trim().length,
      finalHtmlLength: latestHtml.length,
    });
  } catch (error: any) {
    const response =
      responseText.trim() ||
      error?.statusMessage ||
      error?.message ||
      "Generation failed";
    console.error("[generate] failed", {
      pageId: prompt.pageId,
      promptId: prompt.id,
      responseLength: responseText.trim().length,
      finalHtmlLength: latestHtml.length,
      error: error?.statusMessage || error?.message || "Generation failed",
    });
    await db
      .update(schema.prompts)
      .set({ response, html: latestHtml })
      .where(eq(schema.prompts.id, prompt.id));
    await storage.setItem(`pages:${prompt.pageId}`, {
      id: prompt.id,
      response,
    });

    throw error;
  }
}

