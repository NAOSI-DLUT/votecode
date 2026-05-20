import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSetItem = vi.fn();
const mockGetItem = vi.fn();

const mockStreamText = vi.fn();
const mockRawTool = vi.fn((toolDef: any) => toolDef);

const mockTxExecute = vi.fn();
const mockTxSelect = vi.fn();
const mockTxUpdate = vi.fn();
const mockTxQueryPageFindFirst = vi.fn();

const mockDbSelectWhere = vi.fn();
const mockDbSelectFrom = vi.fn(() => ({ where: mockDbSelectWhere }));
const mockDbSelect = vi.fn(() => ({ from: mockDbSelectFrom }));
const mockDbTransaction = vi.fn();

vi.mock("xsai", () => ({
  streamText: mockStreamText,
  rawTool: mockRawTool,
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: any[]) => ({ type: "and", args })),
  count: vi.fn((arg: any) => ({ type: "count", arg })),
  desc: vi.fn((arg: any) => ({ type: "desc", arg })),
  eq: vi.fn((a: any, b: any) => ({ type: "eq", a, b })),
  getTableColumns: vi.fn(() => ({})),
  isNotNull: vi.fn((arg: any) => ({ type: "notNull", arg })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: any[]) => ({
      type: "sql",
      strings,
      values,
    }),
    { raw: vi.fn() },
  ),
}));

vi.mock("@nuxthub/db", () => {
  const schema = {
    pages: { id: "pages.id", offset: "pages.offset", html: "pages.html" },
    prompts: {
      id: "prompts.id",
      pageId: "prompts.pageId",
      userId: "prompts.userId",
      pending: "prompts.pending",
      content: "prompts.content",
      response: "prompts.response",
      createdAt: "prompts.createdAt",
    },
    votes: { promptId: "votes.promptId" },
    users: { id: "users.id", name: "users.name" },
  };

  const db = {
    select: mockDbSelect,
    transaction: mockDbTransaction,
  };

  return { db, schema };
});

function makeSelectChain(rows: any[]) {
  return {
    from: vi.fn(() => makeSelectChain(rows)),
    where: vi.fn(() => makeSelectChain(rows)),
    leftJoin: vi.fn(() => makeSelectChain(rows)),
    groupBy: vi.fn(async () => rows),
    orderBy: vi.fn(() => makeSelectChain(rows)),
    limit: vi.fn(async () => rows),
  };
}

function setupCommonDbState(initialHtml = "<html>\nold\n</html>") {
  mockDbSelectWhere.mockResolvedValue([{ id: "page-1" }]);

  mockTxExecute.mockResolvedValue([{ lock: true }]);
  mockTxQueryPageFindFirst.mockResolvedValue({
    id: "page-1",
    html: initialHtml,
  });

  const pendingPrompts = [
    {
      id: 42,
      pageId: "page-1",
      userId: 7,
      pending: true,
      content: "make button red",
      response: null,
      createdAt: new Date("2026-05-17T00:00:00.000Z"),
      voteCount: 3,
      userName: "alice",
    },
  ];
  const historyPrompts = [
    { userId: 1, content: "old request", response: "old response" },
  ];

  mockTxSelect
    .mockImplementationOnce(() => makeSelectChain(pendingPrompts))
    .mockImplementationOnce(() => makeSelectChain(historyPrompts));

  const updateWhere = vi.fn(async () => ({}));
  mockTxUpdate.mockReturnValue({
    set: vi.fn(() => ({
      where: updateWhere,
    })),
  });

  const tx = {
    execute: mockTxExecute,
    query: { pages: { findFirst: mockTxQueryPageFindFirst } },
    select: mockTxSelect,
    update: mockTxUpdate,
  };

  mockDbTransaction.mockImplementation(async (cb: any) => cb(tx));
}

describe("generate task streaming", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.stubGlobal("defineTask", (task: any) => task);
    vi.stubGlobal("useStorage", () => ({
      setItem: mockSetItem,
      getItem: mockGetItem,
    }));
    vi.stubGlobal("useAppConfig", () => ({ voteIntervalMinutes: 10 }));
    vi.stubGlobal("createError", (input: any) => {
      const err = new Error(input?.statusMessage || "error");
      (err as any).statusCode = input?.statusCode;
      throw err;
    });
  });

  it("applies one range edit, streams response, and persists final state", async () => {
    setupCommonDbState("<html>\nold\n</html>");

    mockStreamText.mockImplementation(({ tools, maxSteps }: any) => {
      expect(maxSteps).toBe(6);
      const readHtmlTool = tools.find((t: any) => t.name === "read_html");
      const writeRangeTool = tools.find(
        (t: any) => t.name === "write_html_range",
      );
      expect(readHtmlTool).toBeTruthy();
      expect(writeRangeTool).toBeTruthy();

      const fullStream = (async function* () {
        const currentHtml = await readHtmlTool.execute({});
        expect(currentHtml).toBe("<html>\nold\n</html>");
        await writeRangeTool.execute({
          startLine: 2,
          endLine: 2,
          newLines: ["step-final"],
        });
        yield { type: "text-delta", text: "hello " };
        yield { type: "text-delta", text: "world" };
      })();
      return { fullStream };
    });

    const mod = await import("./generate");
    await mod.default.run({} as any);

    const htmlWrites = mockSetItem.mock.calls.filter(
      ([key]) => key === "pages:page-1:html",
    );
    expect(htmlWrites.length).toBeGreaterThanOrEqual(2);
    expect(htmlWrites[0]?.[1]).toBe("<html>\nstep-final\n</html>");
    expect(htmlWrites[htmlWrites.length - 1]?.[1]).toBe(
      "<html>\nstep-final\n</html>",
    );

    const promptWrites = mockSetItem.mock.calls.filter(
      ([key]) => key === "pages:page-1:prompts:42",
    );
    expect(promptWrites.length).toBeGreaterThanOrEqual(2);
    expect(promptWrites[0]?.[1]).toEqual({ response: "hello " });
    expect(promptWrites[1]?.[1]).toEqual({ response: "hello world" });

    const refreshWrites = mockSetItem.mock.calls.filter(
      ([key]) => key === "pages:page-1:refresh",
    );
    expect(refreshWrites.length).toBe(1);
    expect(refreshWrites[0]?.[1]).toBe(true);

    expect(mockTxUpdate).toHaveBeenCalledTimes(3);
  });

  it("applies multiple range edits and broadcasts html after each write", async () => {
    setupCommonDbState("<html>\nold-a\nold-b\n</html>");

    mockStreamText.mockImplementation(({ tools }: any) => {
      const writeRangeTool = tools.find(
        (t: any) => t.name === "write_html_range",
      );
      const fullStream = (async function* () {
        await writeRangeTool.execute({
          startLine: 2,
          endLine: 2,
          newLines: ["new-a"],
        });
        await writeRangeTool.execute({
          startLine: 3,
          endLine: 3,
          newLines: ["new-b"],
        });
        yield { type: "text-delta", text: "done" };
      })();
      return { fullStream };
    });

    const mod = await import("./generate");
    await mod.default.run({} as any);

    const htmlWrites = mockSetItem.mock.calls.filter(
      ([key]) => key === "pages:page-1:html",
    );
    expect(htmlWrites.length).toBeGreaterThanOrEqual(3);
    expect(htmlWrites[0]?.[1]).toBe("<html>\nnew-a\nold-b\n</html>");
    expect(htmlWrites[1]?.[1]).toBe("<html>\nnew-a\nnew-b\n</html>");
    expect(htmlWrites[htmlWrites.length - 1]?.[1]).toBe(
      "<html>\nnew-a\nnew-b\n</html>",
    );
  });

  it("skips persistence when range is invalid", async () => {
    setupCommonDbState("<html>\nold\n</html>");

    mockStreamText.mockImplementation(({ tools }: any) => {
      const writeRangeTool = tools.find(
        (t: any) => t.name === "write_html_range",
      );
      const fullStream = (async function* () {
        await writeRangeTool.execute({
          startLine: 0,
          endLine: 1,
          newLines: ["x"],
        });
        yield { type: "text-delta", text: "never" };
      })();
      return { fullStream };
    });

    const mod = await import("./generate");
    const result = await mod.default.run({} as any);
    expect(result).toEqual({
      result: {
        offset: expect.any(Number),
        processed: 1,
      },
    });

    const htmlWrites = mockSetItem.mock.calls.filter(
      ([key]) => key === "pages:page-1:html",
    );
    expect(htmlWrites.length).toBe(0);

    expect(mockTxUpdate).toHaveBeenCalledTimes(0);
  });
});
