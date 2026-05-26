import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStreamText = vi.fn();
const mockRawTool = vi.fn((toolDef: any) => toolDef);

const mockPromptFindFirst = vi.fn();
const mockDbUpdateWhere = vi.fn(async () => ({}));
const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));

const mockSetItem = vi.fn();

vi.mock("xsai", () => ({
  streamText: mockStreamText,
  rawTool: mockRawTool,
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: any[]) => ({ type: "and", conditions })),
  eq: vi.fn((a: any, b: any) => ({ type: "eq", a, b })),
}));

vi.mock("@nuxthub/db", () => {
  const schema = {
    prompts: {
      id: "prompts.id",
      pageId: "prompts.pageId",
    },
  };
  const db = {
    query: {
      prompts: {
        findFirst: mockPromptFindFirst,
      },
    },
    update: mockDbUpdate,
  };
  return { db, schema };
});

describe("generate utils", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.stubGlobal("useStorage", () => ({ setItem: mockSetItem }));
    vi.stubGlobal("createError", (input: any) => {
      const err = new Error(input?.statusMessage || "error");
      (err as any).statusCode = input?.statusCode;
      throw err;
    });
  });

  it("modifies html via replace_html tool and persists final html/response", async () => {
    mockPromptFindFirst
      .mockResolvedValueOnce({
        id: 10,
        pageId: "page-1",
        parent: 9,
        content: "change title",
      })
      .mockResolvedValueOnce({
        id: 9,
        html: "<html>\n<title>Old</title>\n<body>Hi</body>\n</html>",
      });

    mockStreamText.mockImplementation(({ tools, maxSteps }: any) => {
      expect(maxSteps).toBe(10);

      const readHtmlTool = tools.find((t: any) => t.name === "read_html");
      const replaceHtmlTool = tools.find((t: any) => t.name === "replace_html");

      expect(readHtmlTool).toBeTruthy();
      expect(replaceHtmlTool).toBeTruthy();

      const fullStream = (async function* () {
        const before = await readHtmlTool.execute({});
        expect(before).toContain("<title>Old</title>");

        await replaceHtmlTool.execute({
          pattern: "<title>Old</title>",
          replacement: "<title>New</title>",
          regex: false,
        });

        const after = await readHtmlTool.execute({});
        expect(after).toContain("<title>New</title>");

        yield { type: "text-delta", text: "updated " };
        yield { type: "text-delta", text: "done" };
      })();

      return { fullStream };
    });

    const { generate } = await import("./generate");
    await generate("page-1", 10);

    expect(mockDbUpdate).toHaveBeenCalledTimes(3);
    expect(mockDbUpdateSet).toHaveBeenCalledWith({
      response: null,
      html: "<html>\n<title>Old</title>\n<body>Hi</body>\n</html>",
    });
    expect(mockDbUpdateSet).toHaveBeenCalledWith({
      html: "<html>\n<title>New</title>\n<body>Hi</body>\n</html>",
    });
    expect(mockDbUpdateSet).toHaveBeenCalledWith({
      response: "updated done",
      html: "<html>\n<title>New</title>\n<body>Hi</body>\n</html>",
    });

    expect(mockSetItem).toHaveBeenCalledWith("pages:page-1", {
      id: 10,
      response: null,
      refresh: true,
    });
    expect(mockSetItem).toHaveBeenCalledWith("pages:page-1", {
      id: 10,
      refresh: true,
    });
    expect(mockSetItem).toHaveBeenCalledWith("pages:page-1", {
      id: 10,
      response: "updated ",
    });
    expect(mockSetItem).toHaveBeenCalledWith("pages:page-1", {
      id: 10,
      response: "updated done",
    });
  });
});
