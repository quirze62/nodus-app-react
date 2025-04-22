import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  publicKey: text("public_key").notNull().unique(),
  privateKey: text("private_key"),
  npub: text("npub"),
  nsec: text("nsec"),
  displayName: text("display_name"),
  about: text("about"),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  content: text("content").notNull(),
  tags: jsonb("tags"),
  eventId: text("event_id").unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id),
  receiverId: integer("receiver_id").references(() => users.id),
  content: text("content").notNull(),
  encrypted: boolean("encrypted").default(true),
  eventId: text("event_id").unique(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const follows = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").references(() => users.id),
  followingId: integer("following_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  publicKey: true,
  privateKey: true,
  npub: true,
  nsec: true,
  displayName: true,
  about: true,
  avatar: true,
});

export const insertNoteSchema = createInsertSchema(notes).pick({
  userId: true,
  content: true,
  tags: true,
  eventId: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  senderId: true,
  receiverId: true,
  content: true,
  encrypted: true,
  eventId: true,
});

export const insertFollowSchema = createInsertSchema(follows).pick({
  followerId: true,
  followingId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Follow = typeof follows.$inferSelect;
