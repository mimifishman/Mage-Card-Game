import { db } from "@workspace/db";
import {
  matchesTable,
  matchPlayersTable,
  gameStateTable,
  gameActionsLogTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, or, inArray, sql } from "drizzle-orm";
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

  const players = await db
    .select()
    .from(matchPlayersTable)
    .where(eq(matchPlayersTable.matchId, match.id));

  const alreadyJoined = players.some((p) => p.userId === userId);

  if (match.status === "in_progress") {
    if (alreadyJoined) return { ok: true as const, match, isRejoin: true };
    return { ok: false as const, error: "Match already started or finished" };
  }

  if (match.status !== "waiting") return { ok: false as const, error: "Match already started or finished" };

  if (alreadyJoined) return { ok: true as const, match, isRejoin: true };

  if (players.length >= 4) return { ok: false as const, error: "Match is full" };

  await db.insert(matchPlayersTable).values({
    matchId: match.id,
    userId,
    turnOrder: players.length,
  });

  return { ok: true as const, match, isRejoin: false };
}

export async function getMatchWithPlayers(matchId: string) {
  const [match] = await db
    .select()
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId));
  if (!match) return null;

  const rows = await db
    .select({
      userId: matchPlayersTable.userId,
      turnOrder: matchPlayersTable.turnOrder,
      life: matchPlayersTable.life,
      isEliminated: matchPlayersTable.isEliminated,
      joinedAt: matchPlayersTable.joinedAt,
      displayName: usersTable.displayName,
      providerUserId: usersTable.providerUserId,
    })
    .from(matchPlayersTable)
    .innerJoin(usersTable, eq(matchPlayersTable.userId, usersTable.id))
    .where(eq(matchPlayersTable.matchId, matchId));

  return { match, players: rows };
}

/**
 * Creates a solo match: the human host at turnOrder 0 and the AI opponent at
 * turnOrder 1. The caller is expected to start the match immediately.
 */
export async function createVsAiMatch(
  hostUserId: string,
  botUserId: string,
  botPersona?: string,
) {
  const inviteCode = generateInviteCode();
  const [match] = await db
    .insert(matchesTable)
    .values({ createdBy: hostUserId, inviteCode, botPersona: botPersona ?? null })
    .returning();
  if (!match) throw new Error("Failed to create match");

  await db.insert(matchPlayersTable).values([
    { matchId: match.id, userId: hostUserId, turnOrder: 0 },
    { matchId: match.id, userId: botUserId, turnOrder: 1 },
  ]);

  return match;
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
  const state = row.fullState as unknown as EngineGameState;
  return {
    ...state,
    hasAttackedThisTurn: state.hasAttackedThisTurn ?? false,
  };
}

export async function saveEngineState(matchId: string, engineState: EngineGameState): Promise<void> {
  // Keep match_players.life / is_eliminated mirroring the engine state so
  // lobby/scoreboard views (which read match_players, not the JSONB state)
  // never show stale life totals.
  const playerSyncs = Object.values(engineState.players).map((p) =>
    db
      .update(matchPlayersTable)
      .set({ life: p.life, isEliminated: p.isEliminated })
      .where(
        and(
          eq(matchPlayersTable.matchId, matchId),
          eq(matchPlayersTable.userId, p.id),
        ),
      ),
  );

  await Promise.all([
    ...playerSyncs,
    db
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
      .where(eq(gameStateTable.matchId, matchId)),
    db
      .update(matchesTable)
      .set({
        currentTurnPlayerId: engineState.activePlayerId,
        turnNumber: engineState.turnNumber,
      })
      .where(eq(matchesTable.id, matchId)),
  ]);
}

export async function finishMatch(matchId: string, winnerUserId: string | null): Promise<void> {
  await db
    .update(matchesTable)
    .set({ status: "finished", finishedAt: new Date(), winnerUserId })
    .where(eq(matchesTable.id, matchId));
}

export async function createRematch(matchId: string): Promise<string> {
  const players = await db
    .select({ userId: matchPlayersTable.userId, turnOrder: matchPlayersTable.turnOrder })
    .from(matchPlayersTable)
    .where(eq(matchPlayersTable.matchId, matchId))
    .orderBy(matchPlayersTable.turnOrder);

  if (players.length === 0) throw new Error("No players found for match");

  const [oldMatch] = await db
    .select({ botPersona: matchesTable.botPersona })
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId));

  const hostUserId = players[0]!.userId;
  const inviteCode = generateInviteCode();

  const [newMatch] = await db
    .insert(matchesTable)
    // Rematches keep the same bot persona the player originally chose.
    .values({ createdBy: hostUserId, inviteCode, botPersona: oldMatch?.botPersona ?? null })
    .returning();
  if (!newMatch) throw new Error("Failed to create rematch");

  await db.insert(matchPlayersTable).values(
    players.map((p) => ({
      matchId: newMatch.id,
      userId: p.userId,
      turnOrder: p.turnOrder,
    })),
  );

  return newMatch.id;
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

export async function getOpenMatchesForUser(
  userId: string,
): Promise<{ matchId: string; inviteCode: string; status: string; playerCount: number; playerNames: string[] }[]> {
  const rows = await db
    .select({
      matchId: matchesTable.id,
      inviteCode: matchesTable.inviteCode,
      status: matchesTable.status,
    })
    .from(matchPlayersTable)
    .innerJoin(matchesTable, eq(matchPlayersTable.matchId, matchesTable.id))
    .where(
      and(
        eq(matchPlayersTable.userId, userId),
        or(eq(matchesTable.status, "waiting"), eq(matchesTable.status, "in_progress")),
      ),
    );

  if (rows.length === 0) return [];

  const matchIds = rows.map((r) => r.matchId);
  const playerRows = await db
    .select({
      matchId: matchPlayersTable.matchId,
      displayName: usersTable.displayName,
    })
    .from(matchPlayersTable)
    .innerJoin(usersTable, eq(matchPlayersTable.userId, usersTable.id))
    .where(inArray(matchPlayersTable.matchId, matchIds));

  const playersByMatch = new Map<string, string[]>();
  for (const row of playerRows) {
    const names = playersByMatch.get(row.matchId) ?? [];
    names.push(row.displayName);
    playersByMatch.set(row.matchId, names);
  }

  return rows.map((r) => ({
    matchId: r.matchId,
    inviteCode: r.inviteCode,
    status: r.status,
    playerCount: playersByMatch.get(r.matchId)?.length ?? 1,
    playerNames: playersByMatch.get(r.matchId) ?? [],
  }));
}

export async function logAction(
  matchId: string,
  userId: string,
  action: GameAction,
  turnNumber: number,
  handsSnapshot?: Record<string, string[]>,
): Promise<void> {
  await db.insert(gameActionsLogTable).values({
    matchId,
    userId,
    actionType: action.type,
    payload: action as unknown as Record<string, unknown>,
    turnNumber,
    // Server-side audit trail only — never exposed through any client API.
    handsSnapshot: (handsSnapshot ?? null) as unknown as Record<string, unknown>,
  });
}
