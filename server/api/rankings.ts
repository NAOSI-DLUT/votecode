import { db, schema } from "@nuxthub/db";
import { count, desc, eq } from "drizzle-orm";

export default defineEventHandler(async () => {
  const users = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      avatarUrl: schema.users.avatar_url,
      htmlUrl: schema.users.html_url,
      voteCount: count(schema.votes).as("voteCount"),
    })
    .from(schema.users)
    .leftJoin(schema.prompts, eq(schema.prompts.userId, schema.users.id))
    .leftJoin(schema.votes, eq(schema.votes.promptId, schema.prompts.id))
    .groupBy(
      schema.users.id,
      schema.users.name,
      schema.users.avatar_url,
      schema.users.html_url,
    )
    .orderBy(desc(count(schema.votes)));

  const pages = await db
    .select({
      id: schema.pages.id,
      voteCount: count(schema.votes).as("voteCount"),
    })
    .from(schema.pages)
    .leftJoin(schema.prompts, eq(schema.prompts.pageId, schema.pages.id))
    .leftJoin(schema.votes, eq(schema.votes.promptId, schema.prompts.id))
    .groupBy(schema.pages.id)
    .orderBy(desc(count(schema.votes)));

  return { users, pages };
});
