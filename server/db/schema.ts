import { isNull } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  uniqueIndex,
  index,
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
    uniqueIndex("null_response_unique_idx")
      .on(table.page_id, table.user_id)
      .where(isNull(table.response)),
  ],
);

export const votes = pgTable(
  "votes",
  {
    id: serial().primaryKey(),
    prompt_id: serial()
      .references(() => prompts.id)
      .notNull(),
    user_id: integer()
      .references(() => users.id)
      .notNull(),
  },
  (table) => [
    index("prompt_idx").on(table.prompt_id),
    index("user_idx").on(table.user_id),
  ],
);
