import { db } from "@workspace/db";
import {
  matchesTable,
  matchPlayersTable,
  gameStateTable,
  gameActionsLogTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import type { GameState as EngineGameState } from "../game/types";
import type { GameAction } from "../game/actions";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createMatch(hostUserId: string) {
  const inviteCode = generateInviteCode();
  const [match] = await db
    .insert(matchesTable)
    .values({ createdBy: hostUserId, inviteCode })
    .returning();
  if (!match) throw new Error("Failed to create match");

  await db.insert(matchPlayersTable).values({
    matchId: match.id,
    userId: hostUserId,
    turnOrder: 0,
  });

  return match;
}

export async function joinMatchByCode(inviteCode: string, userId: string) {
  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.inviteCode, inviteCode.toUpperCase()));

  if (!match) return { ok: false as const, error: "Match not found" };
  if (match.status !== "waiting") return { ok: false as const, error: "Match already started or finished" };

  const players = await db
    .select()
    .from(matchPlayersTable)
    .where(eq(matchPlayersTable.matchId, match.id));

  if (players.length >= 4) return { ok: false as const, error: "Match is full" };

  const alreadyJoined = players.some((p) => p.userId === userId);
  if (alreadyJoined) return { ok: false as const, error: "Already joined this match" };

  await db.insert(matchPlayersTable).values({
    matchId: match.id,
    userId,
    turnOrder: players.length,
  });

  return { ok: true as const, match };
}

export async function getMatchWithPlayers(matchId: string) {
  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId));
  if (!match) return null;

  const players = await db
    .select()
    .from(matchPlayersTable)
    .where(eq(matchPlayersTable.matchId, matchId));

  return { match, players };
}

export async function isMatchHost(matchId: string, userId: string): Promise<boolean> {
  const [match] = await db
    .select()
    .from(matchesTable)
    .where(and(eq(matchesTable.id, matchId), eq(matchesTable.createdBy, userId)));
  return !!match;
}

export async function isMatchPlayer(matchId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(matchPlayersTable)
    .where(
      and(eq(matchPlayersTable.matchId, matchId), eq(matchPlayersTable.userId, userId)),
    );
  return !!row;
}

export async function getMatchPlayerOrder(matchId: string): Promise<string[]> {
  const players = await db
    .select()
    .from(matchPlayersTable)
    .where(eq(matchPlayersTable.matchId, matchId))
    .orderBy(matchPlayersTable.turnOrder);
  return players.map((p) => p.userId);
}

export async function startMatch(matchId: string, engineState: EngineGameState): Promise<void> {
  await db
    .update(matchesTable)
    .set({
      status: "in_progress",
      startedAt: new Date(),
      currentTurnPlayerId: engineState.activePlayerId,
      turnNumber: engineState.turnNumber,
    })
    .where(eq(matchesTable.id, matchId));

  await db.insert(gameStateTable).values({
    matchId,
    fullState: engineState as unknown as Record<string, unknown>,
    deck: engineState.deck as unknown as Record<string, unknown>,
    abyss: engineState.abyss as unknown as Record<string, unknown>,
    handByPlayer: Object.fromEntries(
      Object.entries(engineState.players).map(([id, p]) => [id, p.hand]),
    ) as unknown as Record<string, unknown>,
    courtByPlayer: Object.fromEntries(
      Object.entries(engineState.players).map(([id, p]) => [id, p.court]),
    ) as unknown as Record<string, unknown>,
  });
}

export async function loadEngineState(matchId: string): Promise<EngineGameState | null> {
  const [row] = await db
    .select()
    .from(gameStateTable)
    .where(eq(gameStateTable.matchId, matchId));
  if (!row || !row.fullState) return null;
  return row.fullState as unknown as EngineGameState;
}

export async function saveEngineState(matchId: string, engineState: EngineGameState): Promise<void> {
  await db
    .update(gameStateTable)
    .set({
      fullState: engineState as unknown as Record<string, unknown>,
      deck: engineState.deck as unknown as Record<string, unknown>,
      abyss: engineState.abyss as unknown as Record<string, unknown>,
      handByPlayer: Object.fromEntries(
        Object.entries(engineState.players).map(([id, p]) => [id, p.hand]),
      ) as unknown as Record<string, unknown>,
      courtByPlayer: Object.fromEntries(
        Object.entries(engineState.players).map(([id, p]) => [id, p.court]),
      ) as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(gameStateTable.matchId, matchId));

  await db
    .update(matchesTable)
    .set({
      currentTurnPlayerId: engineState.activePlayerId,
      turnNumber: engineState.turnNumber,
    })
    .where(eq(matchesTable.id, matchId));
}

export async function finishMatch(matchId: string, winnerUserId: string): Promise<void> {
  await db
    .update(matchesTable)
    .set({ status: "finished", finishedAt: new Date(), winnerUserId })
    .where(eq(matchesTable.id, matchId));
}

export async function getActiveMatchForUser(userId: string): Promise<string | null> {
  const rows = await db
    .select({ matchId: matchPlayersTable.matchId })
    .from(matchPlayersTable)
    .innerJoin(matchesTable, eq(matchPlayersTable.matchId, matchesTable.id))
    .where(
      and(
        eq(matchPlayersTable.userId, userId),
        eq(matchesTable.status, "in_progress"),
      ),
    )
    .limit(1);
  return rows[0]?.matchId ?? null;
}

export async function logAction(
  matchId: string,
  userId: string,
  action: GameAction,
  turnNumber: number,
): Promise<void> {
  await db.insert(gameActionsLogTable).values({
    matchId,
    userId,
    actionType: action.type,
    payload: action as unknown as Record<string, unknown>,
    turnNumber,
  });
}
