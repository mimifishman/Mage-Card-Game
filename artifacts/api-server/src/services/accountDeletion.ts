import type { Request, Response } from "express";

/**
 * In-app account deletion (App Store rule 5.1.1(v), Google Play's equivalent).
 *
 * This module holds the pure parts — the per-match plan and the HTTP handler —
 * with the database and Clerk calls injected, so it can be tested without a
 * database. The real wiring lives in routes/auth.ts and
 * repositories/accountRepository.ts.
 *
 * Policy, per match the user belongs to:
 * - No other human in it (solo vs the AI, or a lobby nobody joined): delete the
 *   whole match — state, action log, players. Nobody else has a record there.
 * - Shared with another human and still waiting / in progress: end it. A 1v1
 *   in progress is a forfeit (the opponent wins); anything else ends with no
 *   winner, like "abandon". Then treat it as a kept match.
 * - Shared and finished: keep it, so the other players' history stays intact.
 *
 * Kept matches still point at the user's `users` row, so that row is
 * anonymised (name scrubbed, Clerk id replaced) instead of deleted. When no
 * match is kept, the row is deleted outright.
 */

export const DELETED_PLAYER_NAME = "Deleted player";
/** Replaces the Clerk id on an anonymised row; never matches a real provider id. */
export const DELETED_PROVIDER_PREFIX = "deleted:";

type MatchStatus = "waiting" | "in_progress" | "finished";

export interface MembershipMatch {
  id: string;
  status: MatchStatus;
  players: { userId: string; isBot: boolean }[];
}

export interface EndedMatch {
  matchId: string;
  winnerUserId: string | null;
  /** The remaining human players, who get a game_over push. */
  notifyUserIds: string[];
}

export interface AccountDeletionPlan {
  deleteMatchIds: string[];
  endMatches: EndedMatch[];
  /** Matches that stay in the database (ended + already finished shared ones). */
  keptMatchIds: string[];
  /** True when kept matches still reference the user, so the row is anonymised. */
  keepUserRow: boolean;
}

export function planAccountDeletion(userId: string, matches: MembershipMatch[]): AccountDeletionPlan {
  const plan: AccountDeletionPlan = { deleteMatchIds: [], endMatches: [], keptMatchIds: [], keepUserRow: false };

  for (const match of matches) {
    if (!match.players.some((p) => p.userId === userId)) continue;

    const otherHumans = match.players.filter((p) => p.userId !== userId && !p.isBot).map((p) => p.userId);
    if (otherHumans.length === 0) {
      plan.deleteMatchIds.push(match.id);
      continue;
    }

    if (match.status !== "finished") {
      const winnerUserId = match.status === "in_progress" && otherHumans.length === 1 ? otherHumans[0]! : null;
      plan.endMatches.push({ matchId: match.id, winnerUserId, notifyUserIds: otherHumans });
    }
    plan.keptMatchIds.push(match.id);
  }

  plan.keepUserRow = plan.keptMatchIds.length > 0;
  return plan;
}

export interface AccountDeletionDeps {
  /** Removes / anonymises the user's rows in one transaction; returns the matches it ended. */
  deleteUserData(internalUserId: string): Promise<EndedMatch[]>;
  /** Tells the remaining players a match ended. Must not throw. */
  notifyEndedMatches(ended: EndedMatch[]): void;
  /** Deletes the user from the auth provider (Clerk). */
  deleteAuthUser(providerUserId: string): Promise<void>;
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { status?: unknown }).status === 404;
}

export function createDeleteAccountHandler(deps: AccountDeletionDeps) {
  return async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    // Only ever the caller's own ids from the verified session — never the body or params.
    const { internalUserId, providerUserId } = req.user;

    let ended: EndedMatch[];
    try {
      ended = await deps.deleteUserData(internalUserId);
    } catch (err) {
      req.log.error({ err }, "Account deletion: database step failed");
      res.status(500).json({ error: "Failed to delete account" });
      return;
    }

    deps.notifyEndedMatches(ended);

    // Clerk goes last, after the database work has committed. If it fails the
    // user can retry: their next request creates a fresh, empty users row
    // (the old one no longer carries the Clerk id), and this runs again.
    try {
      await deps.deleteAuthUser(providerUserId);
    } catch (err) {
      if (!isNotFound(err)) {
        req.log.error({ err }, "Account deletion: Clerk delete failed after database step");
        res.status(502).json({ error: "Failed to delete sign-in account. Please try again." });
        return;
      }
    }

    req.log.info({ userId: internalUserId, endedMatches: ended.length }, "Account deleted");
    res.status(204).end();
  };
}
