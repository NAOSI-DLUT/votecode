import { db, schema } from "@nuxthub/db";
import { count, desc, eq, isNull } from "drizzle-orm";

type CandidatePrompt = {
  id: number;
  pageId: string;
  voteCount: number;
};

async function pickNextPromptForPage(pageId: string) {
  const page = await db.query.pages.findFirst({
    where: eq(schema.pages.id, pageId),
  });
  if (!page) return null;

  const rows = await db
    .select({
      id: schema.prompts.id,
      pageId: schema.prompts.pageId,
      voteCount: count(schema.votes),
    })
    .from(schema.prompts)
    .leftJoin(schema.votes, eq(schema.prompts.id, schema.votes.promptId))
    .where(
      page.latestPrompt === null
        ? isNull(schema.prompts.parent)
        : eq(schema.prompts.parent, page.latestPrompt),
    )
    .groupBy(schema.prompts.id)
    .orderBy(desc(count(schema.votes)), desc(schema.prompts.id))
    .limit(1);

  return (rows[0] ?? null) as CandidatePrompt | null;
}

export default defineTask({
  meta: {
    name: "pickPrompts",
    description: "Pick winning prompts by votes and update each page latest prompt",
  },
  async run() {
    const { voteIntervalMinutes } = useAppConfig();
    const offset = Math.floor((Date.now() / 1000 / 60) % voteIntervalMinutes);
    const pages = await db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(eq(schema.pages.offset, offset));

    let processed = 0;
    for (const page of pages) {
      const candidate = await pickNextPromptForPage(page.id);
      if (!candidate) continue;
      const current = await db.query.pages.findFirst({
        where: eq(schema.pages.id, page.id),
      });
      if (!current) continue;

      const affectedPrompts = await db
        .select({ id: schema.prompts.id })
        .from(schema.prompts)
        .where(
          current.latestPrompt === null
            ? isNull(schema.prompts.parent)
            : eq(schema.prompts.parent, current.latestPrompt),
        );

      await db
        .update(schema.prompts)
        .set({ status: "rejected" })
        .where(
          current.latestPrompt === null
            ? isNull(schema.prompts.parent)
            : eq(schema.prompts.parent, current.latestPrompt),
        );

      await db
        .update(schema.prompts)
        .set({ status: "approved" })
        .where(eq(schema.prompts.id, candidate.id));

      await db
        .update(schema.pages)
        .set({ latestPrompt: candidate.id })
        .where(eq(schema.pages.id, page.id));

      const storage = useStorage();
      for (const prompt of affectedPrompts) {
        await storage.setItem(`pages:${page.id}`, {
          id: prompt.id,
          status: prompt.id === candidate.id ? "approved" : "rejected",
        });
      }
      processed += 1;
    }

    return { result: { offset, processed } };
  },
});
