import { db } from "@workspace/db";
import {
  matchesTable,
  matchPlayersTable,
  gameStateTable,
  gameActionsLogTable,
  usersTable,
} from "@workspace/db/schema";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { isBotProviderId } from "./botRepository";
import { withMatchLock } from "../lib/matchLock";
import {
  DELETED_PLAYER_NAME,
  DELETED_PROVIDER_PREFIX,
  planAccountDeletion,
  type EndedMatch,
  type MembershipMatch,
} from "../services/accountDeletion";

type Executor = Pick<typeof db, "select">;

/** Every match the user is in, with all of its players. */
async function loadMemberships(exec: Executor, userId: string): Promise<MembershipMatch[]> {
  const mine = exec
    .select({ matchId: matchPlayersTable.matchId })
    .from(matchPlayersTable)
    .where(eq(matchPlayersTable.userId, userId));

  const rows = await exec
    .select({
      matchId: matchesTable.id,
      status: matchesTable.status,
      userId: matchPlayersTable.userId,
      providerUserId: usersTable.providerUserId,
    })
    .from(matchesTable)
    .innerJoin(matchPlayersTable, eq(matchPlayersTable.matchId, matchesTable.id))
    .innerJoin(usersTable, eq(usersTable.id, matchPlayersTable.userId))
    .where(inArray(matchesTable.id, mine));

  const byId = new Map<string, MembershipMatch>();
  for (const row of rows) {
    let match = byId.get(row.matchId);
    if (!match) {
      match = { id: row.matchId, status: row.status, players: [] };
      byId.set(row.matchId, match);
    }
    match.players.push({ userId: row.userId, isBot: isBotProviderId(row.providerUserId) });
  }
  return [...byId.values()];
}

/** Holds every listed match lock (in a fixed order) while fn runs. */
function withMatchLocks<T>(matchIds: string[], fn: () => Promise<T>): Promise<T> {
  const [first, ...rest] = matchIds;
  if (first === undefined) return fn();
  return withMatchLock(first, () => withMatchLocks(rest, fn));
}

/**
 * Removes or anonymises everything tied to one user, in a single transaction.
 * See services/accountDeletion.ts for the policy. Holds the match locks of the
 * user's unfinished matches so a concurrent action or bot move can't save over
 * a match we are ending or deleting.
 */
export async function deleteUserAccountData(userId: string): Promise<EndedMatch[]> {
  const before = await loadMemberships(db, userId);
  const lockIds = before.filter((m) => m.status !== "finished").map((m) => m.id).sort();

  return withMatchLocks(lockIds, () =>
    db.transaction(async (tx) => {
      // Re-read inside the lock so the plan reflects the latest statuses.
      const plan = planAccountDeletion(userId, await loadMemberships(tx, userId));

      const deleteIds = plan.deleteMatchIds;
      if (deleteIds.length > 0) {
        await tx.delete(gameActionsLogTable).where(inArray(gameActionsLogTable.matchId, deleteIds));
        await tx.delete(gameStateTable).where(inArray(gameStateTable.matchId, deleteIds));
        await tx.delete(matchPlayersTable).where(inArray(matchPlayersTable.matchId, deleteIds));
        await tx.delete(matchesTable).where(inArray(matchesTable.id, deleteIds));
      }

      for (const ended of plan.endMatches) {
        await tx
          .update(matchesTable)
          .set({ status: "finished", finishedAt: new Date(), winnerUserId: ended.winnerUserId })
          .where(and(eq(matchesTable.id, ended.matchId), ne(matchesTable.status, "finished")));
      }

      if (!plan.keepUserRow) {
        await tx.delete(usersTable).where(eq(usersTable.id, userId));
        return plan.endMatches;
      }

      // Kept matches keep their foreign keys to this row, so scrub it instead.
      await tx
        .update(usersTable)
        .set({ displayName: DELETED_PLAYER_NAME, providerUserId: `${DELETED_PROVIDER_PREFIX}${userId}` })
        .where(eq(usersTable.id, userId));

      // The engine state snapshots each player's display name; scrub that too.
      await tx
        .update(gameStateTable)
        .set({
          fullState: sql`jsonb_set(${gameStateTable.fullState}, ARRAY['players', ${userId}::text, 'displayName'], to_jsonb(${DELETED_PLAYER_NAME}::text), false)`,
        })
        .where(inArray(gameStateTable.matchId, plan.keptMatchIds));

      return plan.endMatches;
    }),
  );
}
