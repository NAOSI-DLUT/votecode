import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  avatar: text().notNull(),
});

export const rooms = pgTable("rooms", {
  id: text().primaryKey(),
});

export const prompts = pgTable("prompts", {
  id: serial().primaryKey(),
  roomId: text()
    .references(() => rooms.id)
    .notNull(),
  userId: serial()
    .references(() => users.id)
    .notNull(),
  content: text().notNull(),
  response: text(),
});

export const votes = pgTable("votes", {
  id: serial().primaryKey(),
  promptId: serial()
    .references(() => prompts.id)
    .notNull(),
  userId: serial()
    .references(() => users.id)
    .notNull(),
});
