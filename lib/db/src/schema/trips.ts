import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tripsTable = pgTable("trips", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  destination: text("destination").notNull(),
  description: text("description"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  creatorId: integer("creator_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTripSchema = createInsertSchema(tripsTable).omit({ id: true, createdAt: true });
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof tripsTable.$inferSelect;

export const tripMembersTable = pgTable("trip_members", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const insertTripMemberSchema = createInsertSchema(tripMembersTable).omit({ id: true, joinedAt: true });
export type InsertTripMember = z.infer<typeof insertTripMemberSchema>;
export type TripMember = typeof tripMembersTable.$inferSelect;
