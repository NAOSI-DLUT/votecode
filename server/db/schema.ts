import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: integer().primaryKey(),
  name: text().notNull(),
  avatar_url: text().notNull(),
  html_url: text().notNull(),
});

export const pages = pgTable("pages", {
  id: text().primaryKey(),
});

export const prompts = pgTable("prompts", {
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
});

export const votes = pgTable("votes", {
  id: serial().primaryKey(),
  prompt_id: serial()
    .references(() => prompts.id)
    .notNull(),
  user_id: integer()
    .references(() => users.id)
    .notNull(),
});
