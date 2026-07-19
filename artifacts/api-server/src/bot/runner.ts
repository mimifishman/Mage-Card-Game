import { logger } from "../lib/logger";
import { withMatchLock } from "../lib/matchLock";
import {
  getMatchWithPlayers,
  loadEngineState,
} from "../repositories/matchRepository";
import { dispatchAction, getTurnHolderId } from "../game/dispatcher";
import { chooseBotAction, fallbackAction, personaForMatch } from "../game/bot";
import { isGameOver } from "../game";
import { applyResultAndBroadcast } from "../services/matchStart";

/** Pause between bot moves so the client can animate each state_update. */
const BOT_MOVE_DELAY_MS = 700;
/** Hard cap per kick — a full bot turn is typically < 20 actions. */
const MAX_ACTIONS_PER_KICK = 300;

const runningMatches = new Set<string>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fire-and-forget: keeps applying bot actions while a bot holds priority in
 * the match. Each iteration reloads fresh state from Postgres inside the
 * per-match lock, so concurrent human plays (interrupts) and abandons are
 * always respected. Safe to call redundantly — overlapping kicks no-op.
 */
export function kickBotRunner(matchId: string, botUserIds: string[]): void {
  if (botUserIds.length === 0) return;
  if (runningMatches.has(matchId)) return;
  runningMatches.add(matchId);

  void runBotLoop(matchId, new Set(botUserIds))
    .catch((err) => {
      logger.error({ err, matchId }, "Bot runner crashed");
    })
    .finally(() => {
      runningMatches.delete(matchId);
    });
}

async function runBotLoop(matchId: string, botIds: Set<string>): Promise<void> {
  for (let i = 0; i < MAX_ACTIONS_PER_KICK; i++) {
    const acted = await withMatchLock(matchId, () => runOneBotAction(matchId, botIds));
    if (!acted) return;
    await sleep(BOT_MOVE_DELAY_MS);
  }
  logger.warn({ matchId }, "Bot runner hit per-kick action cap");
}

/** Returns true if a bot action was applied and the loop should continue. */
async function runOneBotAction(matchId: string, botIds: Set<string>): Promise<boolean> {
  const [data, state] = await Promise.all([
    getMatchWithPlayers(matchId),
    loadEngineState(matchId),
  ]);

  if (!data || data.match.status !== "in_progress" || !state) return false;
  if (isGameOver(state)) return false;

  const holderId = getTurnHolderId(state);
  if (!holderId || !botIds.has(holderId)) return false;

  const persona = personaForMatch(matchId);
  const action = chooseBotAction(state, holderId, { persona });
  let result = dispatchAction(state, holderId, action);

  if (!result.ok) {
    // Should not happen (candidates are engine-validated during scoring), but
    // never let a bug spin the loop: retry once with the terminal fallback.
    logger.error(
      { matchId, botId: holderId, action, phase: state.phase, error: result.error },
      "Bot action rejected by engine — retrying with fallback",
    );
    const fallback = fallbackAction(state, holderId);
    result = dispatchAction(state, holderId, fallback);
    if (!result.ok) {
      logger.error(
        { matchId, botId: holderId, fallback, phase: state.phase, error: result.error },
        "Bot fallback action rejected — stopping bot runner",
      );
      return false;
    }
    await applyResultAndBroadcast(matchId, holderId, fallback, result.value);
    return true;
  }

  await applyResultAndBroadcast(matchId, holderId, action, result.value);
  return true;
}
