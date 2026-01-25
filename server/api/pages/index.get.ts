import { db, schema } from "@nuxthub/db";
import { sql, count, eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  return db
    .select({
      id: schema.pages.id,
      voteCount: count(schema.votes.id).as("voteCount"),
    })
    .from(schema.pages)
    .leftJoin(schema.messages, eq(schema.messages.pageId, schema.pages.id))
    .leftJoin(schema.votes, eq(schema.votes.messageId, schema.messages.id))
    .groupBy(schema.pages.id)
    .orderBy(sql`${count(schema.votes.id)} DESC`)
    .limit(10);
});
