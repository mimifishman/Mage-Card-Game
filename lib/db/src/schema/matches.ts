import { pgTable, varchar, timestamp, integer, boolean, jsonb, text, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const matchStatusEnum = pgEnum("match_status", [
  "waiting",
  "in_progress",
  "finished",
]);

export const matchesTable = pgTable("matches", {
  id: varchar("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  status: matchStatusEnum("status").notNull().default("waiting"),
  inviteCode: varchar("invite_code", { length: 8 }).notNull().unique(),
  createdBy: varchar("created_by")
    .notNull()
    .references(() => usersTable.id),
  currentTurnPlayerId: varchar("current_turn_player_id").references(
    () => usersTable.id,
  ),
  turnNumber: integer("turn_number").notNull().default(0),
  winnerUserId: varchar("winner_user_id").references(() => usersTable.id),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const matchPlayersTable = pgTable("match_players", {
  id: varchar("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  matchId: varchar("match_id")
    .notNull()
    .references(() => matchesTable.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id),
  turnOrder: integer("turn_order").notNull(),
  life: integer("life").notNull().default(20),
  isEliminated: boolean("is_eliminated").notNull().default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const gameStateTable = pgTable("game_state", {
  id: varchar("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  matchId: varchar("match_id")
    .notNull()
    .unique()
    .references(() => matchesTable.id),
  deck: jsonb("deck").notNull().default([]),
  mine: jsonb("mine").notNull().default([]),
  abyss: jsonb("abyss").notNull().default([]),
  handByPlayer: jsonb("hand_by_player").notNull().default({}),
  courtByPlayer: jsonb("court_by_player").notNull().default({}),
  fullState: jsonb("full_state"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const gameActionsLogTable = pgTable("game_actions_log", {
  id: varchar("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  matchId: varchar("match_id")
    .notNull()
    .references(() => matchesTable.id),
  userId: varchar("user_id")
    .notNull()
    .references(() => usersTable.id),
  actionType: text("action_type").notNull(),
  payload: jsonb("payload").notNull().default({}),
  turnNumber: integer("turn_number").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Match = typeof matchesTable.$inferSelect;
export type InsertMatch = typeof matchesTable.$inferInsert;
export type MatchPlayer = typeof matchPlayersTable.$inferSelect;
export type InsertMatchPlayer = typeof matchPlayersTable.$inferInsert;
export type GameState = typeof gameStateTable.$inferSelect;
export type InsertGameState = typeof gameStateTable.$inferInsert;
export type GameActionLog = typeof gameActionsLogTable.$inferSelect;
export type InsertGameActionLog = typeof gameActionsLogTable.$inferInsert;
