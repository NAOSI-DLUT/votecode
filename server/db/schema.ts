import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  avatar: text().notNull(),
});

export const pages = pgTable("pages", {
  id: text().primaryKey(),
});

export const messages = pgTable("messages", {
  id: serial().primaryKey(),
  pageId: text()
    .references(() => pages.id)
    .notNull(),
  userId: serial()
    .references(() => users.id)
    .notNull(),
  content: text().notNull(),
  response: text(),
  createdAt: timestamp().defaultNow().notNull(),
});

export const votes = pgTable("votes", {
  id: serial().primaryKey(),
  messageId: serial()
    .references(() => messages.id)
    .notNull(),
  userId: serial()
    .references(() => users.id)
    .notNull(),
});
