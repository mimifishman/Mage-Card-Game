import { logger } from "../lib/logger";
import { withMatchLock } from "../lib/matchLock";
import {
  getMatchWithPlayers,
  loadEngineState,
} from "../repositories/matchRepository";
import { dispatchAction, getTurnHolderId } from "../game/dispatcher";
import {
  chooseBotAction,
  chooseBotInterrupt,
  fallbackAction,
  personaByName,
  personaForMatch,
  type BotPersona,
} from "../game/bot";
import type { GameState } from "../game/types";
import { isGameOver } from "../game";
import { applyResultAndBroadcast } from "../services/matchStart";

/** Pause between bot moves so the client can animate each state_update. */
const BOT_MOVE_DELAY_MS = 700;
/**
 * Big, story-beat moves get a longer pause so the player can read the log
 * entry and watch the board change before the next move lands.
 */
const BIG_MOVE_DELAY_MS = 1600;
const BIG_MOVE_TYPES = new Set([
  "play_royal_to_court",
  "apply_club",
  "play_joker",
  "declare_attack",
  "confirm_declare_blocks",
]);
/** Hard cap per kick — a full bot turn is typically < 20 actions. */
const MAX_ACTIONS_PER_KICK = 300;

/**
 * At most this many interrupt plays per game turn, so the bot reacts like a
 * player rather than machine-gunning its hand during the human's turn.
 */
const MAX_INTERRUPTS_PER_TURN = 2;

const runningMatches = new Set<string>();
/** Per-match interrupt budget, keyed by the game turn it was spent in. */
const interruptBudget = new Map<string, { turn: number; used: number }>();
/** Latest game turn in which a human took an action, per match. */
const humanActivity = new Map<string, number>();

/**
 * Called by the action route after every successful human action. The bot
 * only interrupts in turns where the human has actually done something —
 * reacting to plays rather than preemptively burning its budget the moment
 * a turn starts.
 */
export function markHumanActivity(matchId: string, turnNumber: number): void {
  humanActivity.set(matchId, turnNumber);
}

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
    const actedType = await withMatchLock(matchId, () => runOneBotAction(matchId, botIds));
    if (actedType === null) return;
    await sleep(BIG_MOVE_TYPES.has(actedType) ? BIG_MOVE_DELAY_MS : BOT_MOVE_DELAY_MS);
  }
  logger.warn({ matchId }, "Bot runner hit per-kick action cap");
}

/**
 * Returns the applied action's type when a bot move was made (so the loop can
 * pace the pause to the move's weight), or null when the loop should stop.
 */
async function runOneBotAction(matchId: string, botIds: Set<string>): Promise<string | null> {
  const [data, state] = await Promise.all([
    getMatchWithPlayers(matchId),
    loadEngineState(matchId),
  ]);

  if (!data || data.match.status !== "in_progress" || !state) return null;
  if (isGameOver(state)) return null;

  // The player-chosen persona (stored on the match) wins; matches created
  // without a choice keep the legacy hash-derived persona. botPersona="random"
  // also lands in the hash fallback (personaByName returns null for it), which
  // is exactly the intent: stable within a match, re-rolled on every rematch
  // because rematches get a fresh match id.
  const persona =
    (data.match.botPersona ? personaByName(data.match.botPersona) : null) ??
    personaForMatch(matchId);

  const holderId = getTurnHolderId(state);
  if (!holderId || !botIds.has(holderId)) {
    // Someone else holds priority — the bot may still react with an
    // interrupt (heal, buff, club…), exactly like a human playing during
    // an opponent's turn.
    return tryBotInterrupt(matchId, state, botIds, persona);
  }

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
      return null;
    }
    await applyResultAndBroadcast(matchId, holderId, fallback, result.value, [...botIds]);
    return fallback.type;
  }

  logger.info({ matchId, botId: holderId, phase: state.phase, action }, "Bot action applied");
  await applyResultAndBroadcast(matchId, holderId, action, result.value, [...botIds]);
  return action.type;
}

/**
 * Plays at most one interrupt for the bot while another player holds
 * priority, budgeted per game turn. Returns the action type when one was
 * played (so the loop paces and re-checks — the bot may chain up to the
 * budget), or null to stop the loop.
 */
async function tryBotInterrupt(
  matchId: string,
  state: GameState,
  botIds: Set<string>,
  persona: BotPersona,
): Promise<string | null> {
  const botId = [...botIds].find((id) => state.players[id] && !state.players[id]!.isEliminated);
  if (!botId) return null;

  // React to plays, not to the clock: stay quiet until the human has done
  // something this game turn.
  if (humanActivity.get(matchId) !== state.turnNumber) return null;

  const budget = interruptBudget.get(matchId);
  const used = budget && budget.turn === state.turnNumber ? budget.used : 0;
  if (used >= MAX_INTERRUPTS_PER_TURN) return null;

  const action = chooseBotInterrupt(state, botId, {
    persona,
    debug: (info) => {
      logger.info({ matchId, botId, ...info }, "Bot interrupt decision");
    },
  });
  if (!action) return null;

  const result = dispatchAction(state, botId, action);
  if (!result.ok) {
    // Interrupts have no legal-fallback obligation — doing nothing is fine.
    logger.warn(
      { matchId, botId, action, phase: state.phase, error: result.error },
      "Bot interrupt rejected by engine — skipping",
    );
    return null;
  }

  interruptBudget.set(matchId, { turn: state.turnNumber, used: used + 1 });
  logger.info(
    { matchId, botId, phase: state.phase, action, interruptNumber: used + 1 },
    "Bot interrupt applied",
  );
  await applyResultAndBroadcast(matchId, botId, action, result.value, [...botIds]);
  return action.type;
}
