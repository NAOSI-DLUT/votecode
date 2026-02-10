import { isNull, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  uniqueIndex,
  index,
  primaryKey,
  boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: integer().primaryKey(),
  name: text().notNull(),
  avatar_url: text().notNull(),
  html_url: text().notNull(),
});

export const pages = pgTable("pages", {
  id: text().primaryKey(),
  offset: integer().notNull(),
  html: text()
    .notNull()
    .default(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>Hello World!</body></html>',
    ),
});

export const prompts = pgTable(
  "prompts",
  {
    id: serial().primaryKey(),
    page_id: text()
      .references(() => pages.id)
      .notNull(),
    user_id: integer()
      .references(() => users.id)
      .notNull(),
    pending: boolean().notNull().default(true),
    content: text().notNull(),
    response: text(),
    created_at: timestamp().notNull().defaultNow(),
  },
  (table) => [
    index("page_id_idx").on(table.page_id),
    uniqueIndex("pending_unique_idx")
      .on(table.page_id, table.user_id)
      .where(sql`${table.pending} = true`),
  ],
);

export const votes = pgTable(
  "votes",
  {
    prompt_id: integer()
      .references(() => prompts.id)
      .notNull(),
    user_id: integer()
      .references(() => users.id)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.prompt_id, table.user_id] })],
);
