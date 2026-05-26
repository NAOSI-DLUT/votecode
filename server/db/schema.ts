import {
  pgEnum,
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: integer().primaryKey(),
  name: text().notNull(),
  avatar_url: text().notNull(),
  html_url: text().notNull(),
});

export const pages = pgTable("pages", {
  id: text().primaryKey(),
  offset: integer().notNull(),
  latestPrompt: integer("latest_prompt"),
});

export const promptStatus = pgEnum("prompt_status", [
  "pending",
  "approved",
  "rejected",
]);

export const prompts = pgTable(
  "prompts",
  {
    id: integer().notNull(),
    pageId: text("page_id")
      .references(() => pages.id)
      .notNull(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    parent: integer("parent"),
    content: text().notNull(),
    response: text(),
    html: text().notNull().default(""),
    status: promptStatus().notNull().default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.pageId, table.id] }),
    index("page_id_idx").on(table.pageId),
    index("parent_idx").on(table.pageId, table.parent),
    uniqueIndex("prompts_parent_user_unique_idx")
      .on(table.pageId, sql`coalesce(${table.parent}, -1)`, table.userId),
  ],
);

export const votes = pgTable(
  "votes",
  {
    pageId: text("page_id")
      .references(() => pages.id)
      .notNull(),
    promptId: integer("prompt_id").notNull(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.pageId, table.promptId, table.userId] })],
);
