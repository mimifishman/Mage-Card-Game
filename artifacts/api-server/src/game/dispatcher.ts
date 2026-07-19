import type { GameState, Result } from "./types";
import type { GameAction } from "./actions";
import { err, ok } from "./types";
import {
  playDiamondToMine,
  discardDiamondToDraw,
  discardDiamondForBoost,
  discardToAbyss,
  playRoyalToCourt,
  attachRoyalSupport,
  attachHeart,
  attachSpade,
  discardHeartToHeal,
  discardSpadeToReturn,
  applyClub,
  confirmClubResponse,
  playJokerDestroyRoyal,
  playJokerDamagePlayer,
  declareAttack,
  confirmDeclareBlocks,
  duelPass,
  endTurn,
  endTurnCleanupAndAdvance,
} from "./index";
import { autoAdvanceDuelIfNeeded, setDamageOrder } from "./combat";
import { canPlayCard, isDuelPhase } from "./validation";

const DUEL_CARD_ACTIONS = new Set([
  "discard_diamond_to_draw",
  "discard_diamond_for_boost",
  "discard_to_abyss",
  "attach_heart",
  "attach_spade",
  "discard_heart_to_heal",
  "discard_spade_to_return",
  "apply_club",
  "play_joker",
  "attach_royal_support",
  "confirm_club_response",
]);

/**
 * Card actions that are eligible to be played by a non-turn-holding player as
 * an interrupt: no Royals (play_royal_to_court), no attacks (declare_attack),
 * and no Diamonds-to-Mine (play_diamond_to_mine). This is the same set as
 * `DUEL_CARD_ACTIONS` minus `confirm_club_response`, which is a duel/response
 * bookkeeping action rather than a card play.
 */
const INTERRUPT_ELIGIBLE_ACTIONS = new Set(
  [...DUEL_CARD_ACTIONS].filter((type) => type !== "confirm_club_response"),
);

function wrapDuelTurn(result: Result<GameState>, actionType: string): Result<GameState> {
  if (!result.ok) return result;
  if (!isDuelPhase(result.value.phase)) return result;
  if (!DUEL_CARD_ACTIONS.has(actionType)) return result;
  return autoAdvanceDuelIfNeeded(result.value);
}

/**
 * Runs a single already-authorized GameAction through the underlying game
 * engine, without any interrupt-stack routing. Used both for actions that are
 * played directly by the player who currently holds priority, and internally
 * to resolve an entry that was popped off the interrupt stack.
 */
function executeGameAction(
  state: GameState,
  playerId: string,
  action: GameAction,
): Result<GameState> {
  switch (action.type) {
    case "play_diamond_to_mine":
      return playDiamondToMine(state, playerId, action.cardId);

    case "discard_diamond_to_draw":
      return wrapDuelTurn(discardDiamondToDraw(state, playerId, action.cardId), action.type);

    case "discard_diamond_for_boost":
      return wrapDuelTurn(
        discardDiamondForBoost(state, playerId, action.cardId, action.targetPlayerId ?? playerId),
        action.type,
      );

    case "discard_to_abyss":
      return wrapDuelTurn(discardToAbyss(state, playerId, action.cardId), action.type);

    case "play_royal_to_court":
      return playRoyalToCourt(state, playerId, action.cardId);

    case "attach_royal_support":
      return wrapDuelTurn(attachRoyalSupport(state, playerId, action.supportCardId, action.targetRoyalId), action.type);

    case "attach_heart":
      return wrapDuelTurn(
        attachHeart(state, playerId, action.heartCardId, action.targetRoyalId, action.targetPlayerId ?? playerId),
        action.type,
      );

    case "attach_spade":
      return wrapDuelTurn(
        attachSpade(state, playerId, action.spadeCardId, action.targetRoyalId, action.targetPlayerId ?? playerId),
        action.type,
      );

    case "discard_heart_to_heal":
      return wrapDuelTurn(
        discardHeartToHeal(state, playerId, action.heartCardId, action.targetPlayerId),
        action.type,
      );

    case "discard_spade_to_return":
      return wrapDuelTurn(discardSpadeToReturn(state, playerId, action.spadeCardId, action.targetCardId), action.type);

    case "apply_club":
      return wrapDuelTurn(applyClub(state, playerId, action.clubCardId, action.targetPlayerId, action.targetRoyalId), action.type);

    case "confirm_club_response":
      return wrapDuelTurn(confirmClubResponse(state, playerId), action.type);

    case "play_joker": {
      const result = action.mode === "destroy_royal"
        ? (() => {
            if (!action.targetPlayerId || !action.targetRoyalId) {
              return err<GameState>("play_joker destroy_royal requires targetPlayerId and targetRoyalId");
            }
            return playJokerDestroyRoyal(state, playerId, action.cardId, action.targetPlayerId, action.targetRoyalId);
          })()
        : (() => {
            if (!action.targetPlayerId) {
              return err<GameState>("play_joker damage_player requires targetPlayerId");
            }
            return playJokerDamagePlayer(state, playerId, action.cardId, action.targetPlayerId);
          })();
      return wrapDuelTurn(result, action.type);
    }

    case "declare_attack":
      return declareAttack(state, playerId, action.targets);

    case "confirm_declare_blocks":
      return confirmDeclareBlocks(state, playerId, action.blocks);

    case "set_damage_order":
      return setDamageOrder(state, playerId, action.assignments);

    case "duel_pass":
      return duelPass(state, playerId);

    case "end_turn":
      return endTurn(state);

    case "discard_to_end_turn": {
      if (state.phase !== "discard") {
        return err(`Cannot discard_to_end_turn outside of discard phase`);
      }
      const activePlayer = state.players[playerId];
      if (!activePlayer) {
        return err(`Player ${playerId} not found`);
      }
      if (state.activePlayerId !== playerId) {
        return err(`It is not your turn`);
      }
      const cardIndex = activePlayer.hand.indexOf(action.cardId);
      if (cardIndex === -1) {
        return err(`Card ${action.cardId} is not in your hand`);
      }
      const newHand = activePlayer.hand.filter((_, i) => i !== cardIndex);
      const updatedState: GameState = {
        ...state,
        players: {
          ...state.players,
          [playerId]: { ...activePlayer, hand: newHand },
        },
        abyss: [...state.abyss, action.cardId],
      };
      if (newHand.length <= 7) {
        return endTurnCleanupAndAdvance(updatedState);
      }
      return ok(updatedState);
    }

    case "interrupt_pass":
      return err(`interrupt_pass must be routed through dispatchAction, not executeGameAction`);

    default: {
      const _exhaustive: never = action;
      return err(`Unknown action type`);
    }
  }
}

/**
 * Returns the id of the field on `action` that holds the card being played,
 * for the subset of actions that are eligible to be pushed onto the
 * interrupt stack. Returns undefined for actions that are not card plays
 * (e.g. `duel_pass`) or are not interrupt-eligible.
 */
function actionCardId(action: GameAction): string | undefined {
  switch (action.type) {
    case "discard_diamond_to_draw":
    case "discard_diamond_for_boost":
    case "discard_to_abyss":
    case "play_joker":
      return action.cardId;
    case "attach_heart":
    case "discard_heart_to_heal":
      return action.heartCardId;
    case "attach_spade":
    case "discard_spade_to_return":
      return action.spadeCardId;
    case "apply_club":
      return action.clubCardId;
    case "attach_royal_support":
      return action.supportCardId;
    default:
      return undefined;
  }
}

/**
 * Returns the id of the player who currently holds "priority" — i.e. whose
 * turn/response it is to act in the current phase. Reuses the same
 * phase-to-actor mapping already encoded in `canPlayCard`.
 */
export function getTurnHolderId(state: GameState): string | undefined {
  switch (state.phase) {
    case "declare_blocks":
      return state.attacks[0]?.targetPlayerId;
    case "duel_attacker_turn":
      return state.duelContext?.attackerPlayerId;
    case "duel_blocker_turn":
      return state.duelContext?.defenderPlayerId;
    case "respond_to_club":
      return state.pendingClubDebuff?.targetPlayerId;
    case "interrupt_window":
      return state.interruptStack?.priorityPlayerId;
    default:
      return state.activePlayerId;
  }
}

/**
 * Resolves an interrupt immediately. A non-active, non-eliminated player may
 * play an eligible card (no Royals, no attacks, no Diamond-to-Mine) during
 * another player's turn/phase; the card takes effect right away and play
 * returns to exactly the phase it was in. There is no priority-passing, no
 * stack, and no response window — the player interrupts, their play happens,
 * and the game moves on.
 */
function handleInterruptImmediate(
  state: GameState,
  playerId: string,
  action: GameAction,
): Result<GameState> {
  if (!INTERRUPT_ELIGIBLE_ACTIONS.has(action.type)) {
    return err(
      `Action "${action.type}" cannot be played during another player's turn — Royals, attacks, and Diamonds to the Mine are only allowed on your own turn`,
    );
  }
  if (state.players[playerId]?.isEliminated) {
    return err(`Eliminated players cannot act`);
  }

  const cardId = actionCardId(action);
  if (!cardId) {
    return err(
      `Action "${action.type}" cannot be played during another player's turn — Royals, attacks, and Diamonds to the Mine are only allowed on your own turn`,
    );
  }

  const returnPhase = state.phase;

  // Resolve the interrupt in a transient "interrupt_window" context so the same
  // eligibility rules (hand membership, no-Royals, vault cost) enforced by
  // canPlayCard's interrupt_window branch — and the duel/target restrictions
  // the card resolvers derive via effectiveDuelPhase — still apply. This window
  // never persists: the card resolves immediately and we restore the phase the
  // game was in, so clients never see an "interrupt_window" phase or a
  // priority-pass prompt.
  const windowState: GameState = {
    ...state,
    phase: "interrupt_window",
    interruptStack: {
      entries: [],
      returnPhase,
      priorityPlayerId: playerId,
      passedPlayerIds: [],
    },
  };

  const canPlay = canPlayCard(windowState, playerId, cardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const result = executeGameAction(windowState, playerId, action);
  if (!result.ok) return result;

  // If the resolver staged a response window (a Club targeting a Royal opens
  // respond_to_club so the Royal's owner can react before the debuff lands),
  // keep that phase — pendingClubDebuff.returnPhase carries the interrupted
  // phase to return to after the response resolves.
  if (result.value.phase === "respond_to_club") {
    return ok({ ...result.value, interruptStack: undefined });
  }

  // Restore the original phase and drop the transient window. Any state the
  // resolver carries back — e.g. a pendingClubDebuff that applyClub's interrupt
  // branch restores when returnPhase is respond_to_club — survives via
  // result.value.
  return ok({ ...result.value, phase: returnPhase, interruptStack: undefined });
}

export function dispatchAction(
  state: GameState,
  playerId: string,
  action: GameAction,
): Result<GameState> {
  if (action.type === "interrupt_pass") {
    // Interrupts now resolve immediately, so there is never an open window to
    // pass on. Retained as a defined action for schema/backward compatibility.
    return err(`Interrupts resolve immediately — there is no window to pass on`);
  }

  const turnHolderId = getTurnHolderId(state);
  if (
    INTERRUPT_ELIGIBLE_ACTIONS.has(action.type) &&
    turnHolderId !== undefined &&
    turnHolderId !== playerId
  ) {
    return handleInterruptImmediate(state, playerId, action);
  }

  return executeGameAction(state, playerId, action);
}
