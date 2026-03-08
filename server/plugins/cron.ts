import { db, schema } from "@nuxthub/db";
import { eq } from "drizzle-orm";
import { CronJob } from "cron";

export default defineNitroPlugin(() => {
  const { voteIntervalMinutes } = useAppConfig();
  const job = new CronJob("* * * * *", async () => {
    const offset = Math.floor((Date.now() / 1000 / 60) % voteIntervalMinutes);
    const pages = await db
      .select({ id: schema.pages.id })
      .from(schema.pages)
      .where(eq(schema.pages.offset, offset));

    await Promise.allSettled(
      pages.map(async (page) => {
        await generate(page.id);
      }),
    );
  });
  job.start();
});
