import {
  getMatchWithPlayers,
  getMatchPlayerOrder,
  startMatch,
  saveEngineState,
  finishMatch,
  logAction,
} from "../repositories/matchRepository";
import {
  createInitialGameState,
  determineFirstPlayer,
  dealInitialHands,
  isGameOver,
  getWinner,
} from "../game";
import type { GameState, Result } from "../game/types";
import { err, ok } from "../game/types";
import type { GameAction } from "../game/actions";
import { broadcastViews } from "../game/serializer";
import { sendToUser } from "../ws/manager";
import { isBotProviderId } from "../repositories/botRepository";

/**
 * Builds the initial engine state for a match and marks it started. Performs
 * NO authorization — host-only / player-count checks belong to the caller
 * (the /start route enforces them for multiplayer; the vs-AI creation path is
 * inherently host-initiated).
 */
export async function initializeAndStartMatch(matchId: string): Promise<Result<GameState>> {
  const data = await getMatchWithPlayers(matchId);
  if (!data) return err("Match not found");

  const playerIds = await getMatchPlayerOrder(matchId);
  const displayNames: Record<string, string> = {};
  for (const p of data.players) {
    displayNames[p.userId] = p.displayName;
  }

  const stateResult = createInitialGameState(matchId, playerIds, displayNames);
  if (!stateResult.ok) return stateResult;

  const withFirst = determineFirstPlayer(stateResult.value);
  if (!withFirst.ok) return withFirst;

  const withHands = dealInitialHands(withFirst.value);
  if (!withHands.ok) return withHands;

  const engineState = withHands.value;
  await startMatch(matchId, engineState);

  const botIds = data.players
    .filter((p) => isBotProviderId(p.providerUserId))
    .map((p) => p.userId);

  broadcastViews(
    engineState,
    playerIds,
    (uid, view) => {
      sendToUser(matchId, uid, { type: "game_started", state: view });
    },
    botIds,
  );

  return ok(engineState);
}

/**
 * Shared post-action tail used by both the human action route and the bot
 * runner: persist the new state, log the action, finish the match when it's
 * over, and push per-player views over WebSocket. Returns the winner's user
 * id when the game ended (null = no winner recorded), undefined otherwise.
 */
export async function applyResultAndBroadcast(
  matchId: string,
  actorUserId: string,
  action: GameAction,
  newState: GameState,
  revealHandsFor?: string[],
): Promise<string | null | undefined> {
  const playerIds = Object.keys(newState.players);

  // Every card involved in a resolved action is public information by the
  // time this broadcast happens (it landed in the mine/abyss/court), so the
  // raw action is safe to share — it lets clients narrate each step in the
  // match log instead of guessing from state diffs.
  const lastAction = { actorUserId, action };

  // Server-side audit trail: every logged action carries a snapshot of all
  // players' hands as of this action resolving. Never sent to clients.
  const handsSnapshot = Object.fromEntries(
    Object.entries(newState.players).map(([id, p]) => [id, p.hand]),
  );

  if (isGameOver(newState)) {
    const winner = getWinner(newState);
    await Promise.all([
      saveEngineState(matchId, newState).then(() =>
        winner ? finishMatch(matchId, winner) : Promise.resolve(),
      ),
      logAction(matchId, actorUserId, action, newState.turnNumber, handsSnapshot),
    ]);

    broadcastViews(
      newState,
      playerIds,
      (uid, view) => {
        sendToUser(matchId, uid, {
          type: "game_over",
          state: view,
          winnerUserId: winner ?? null,
          lastAction,
        });
      },
      revealHandsFor,
    );

    return winner ?? null;
  }

  await Promise.all([
    saveEngineState(matchId, newState),
    logAction(matchId, actorUserId, action, newState.turnNumber, handsSnapshot),
  ]);

  broadcastViews(
    newState,
    playerIds,
    (uid, view) => {
      sendToUser(matchId, uid, { type: "state_update", state: view, lastAction });
    },
    revealHandsFor,
  );

  return undefined;
}
