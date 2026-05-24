import {
  type AnyPgColumn,
  pgTable,
  text,
  serial,
  integer,
  timestamp,
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
  offset: integer().notNull(),
  latestPrompt: integer("latest_prompt"),
});

export const prompts = pgTable(
  "prompts",
  {
    id: serial().primaryKey(),
    pageId: text("page_id")
      .references(() => pages.id)
      .notNull(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
    parent: integer("parent").references((): AnyPgColumn => prompts.id),
    content: text().notNull(),
    response: text(),
    html: text().notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("page_id_idx").on(table.pageId), index("parent_idx").on(table.parent)],
);

export const votes = pgTable(
  "votes",
  {
    promptId: integer("prompt_id")
      .references(() => prompts.id)
      .notNull(),
    userId: integer("user_id")
      .references(() => users.id)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.promptId, table.userId] })],
);
