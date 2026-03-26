import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { tripsTable } from "./trips";

export const tripChatMessagesTable = pgTable("trip_chat_messages", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TripChatMessage = typeof tripChatMessagesTable.$inferSelect;
