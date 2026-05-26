import { db, schema } from "@nuxthub/db";
import { and, asc, count, eq, getTableColumns, sql } from "drizzle-orm";

const { html: _html, ...promptColumns } = getTableColumns(schema.prompts);

export default defineEventHandler(async (event) => {
  const { page_id } = getRouterParams(event);
  if (!page_id) {
    throw createError({
      statusCode: 400,
      statusMessage: "page_id is required",
    });
  }
  const { user } = await getUserSession(event);

  return await db
    .select({
      ...promptColumns,
      user: schema.users,
      voteCount: count(schema.votes),
      voted: sql<boolean>`bool_or(${schema.votes.userId} = ${user?.id ?? ""})`,
    })
    .from(schema.prompts)
    .where(eq(schema.prompts.pageId, page_id))
    .orderBy(asc(schema.prompts.id))
    .leftJoin(schema.users, eq(schema.prompts.userId, schema.users.id))
    .leftJoin(
      schema.votes,
      and(
        eq(schema.prompts.pageId, schema.votes.pageId),
        eq(schema.prompts.id, schema.votes.promptId),
      ),
    )
    .groupBy(schema.prompts.pageId, schema.prompts.id, schema.users.id);
});
