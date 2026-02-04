import { isNull } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: integer().primaryKey(),
  name: text().notNull(),
  avatar_url: text().notNull(),
  html_url: text().notNull(),
});

export const pages = pgTable("pages", {
  id: text().primaryKey(),
  html: text().notNull().default(""),
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
    content: text().notNull(),
    response: text(),
    created_at: timestamp().defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("pending_unique_idx")
      .on(table.page_id, table.user_id)
      .where(isNull(table.response)),
    index("page_id_idx").on(table.page_id),
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
  (table) => [
    primaryKey({ columns: [table.prompt_id, table.user_id] }),
    index("prompt_idx").on(table.prompt_id),
    index("user_idx").on(table.user_id),
  ],
);
