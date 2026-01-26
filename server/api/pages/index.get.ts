import { db, schema } from "@nuxthub/db";
import { count, eq, desc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  return db
    .select({
      id: schema.pages.id,
      voteCount: count(schema.votes.id).as("voteCount"),
    })
    .from(schema.pages)
    .leftJoin(schema.prompts, eq(schema.prompts.page_id, schema.pages.id))
    .leftJoin(schema.votes, eq(schema.votes.prompt_id, schema.prompts.id))
    .groupBy(schema.pages.id)
    .orderBy(desc(count(schema.votes.id)))
    .limit(10);
});
