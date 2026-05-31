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
import { autoAdvanceDuelIfNeeded, resolveCombat, setDamageOrder } from "./combat";
import { isDuelPhase } from "./validation";

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

function wrapDuelTurn(result: Result<GameState>, actionType: string): Result<GameState> {
  if (!result.ok) return result;
  if (!isDuelPhase(result.value.phase)) return result;
  if (!DUEL_CARD_ACTIONS.has(actionType)) return result;
  return autoAdvanceDuelIfNeeded(result.value);
}

export function dispatchAction(
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
      return wrapDuelTurn(discardDiamondForBoost(state, playerId, action.cardId), action.type);

    case "discard_to_abyss":
      return wrapDuelTurn(discardToAbyss(state, playerId, action.cardId), action.type);

    case "play_royal_to_court":
      return playRoyalToCourt(state, playerId, action.cardId);

    case "attach_royal_support":
      return wrapDuelTurn(attachRoyalSupport(state, playerId, action.supportCardId, action.targetRoyalId), action.type);

    case "attach_heart":
      return wrapDuelTurn(attachHeart(state, playerId, action.heartCardId, action.targetRoyalId), action.type);

    case "attach_spade":
      return wrapDuelTurn(attachSpade(state, playerId, action.spadeCardId, action.targetRoyalId), action.type);

    case "discard_heart_to_heal":
      return wrapDuelTurn(discardHeartToHeal(state, playerId, action.heartCardId), action.type);

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
      return declareAttack(state, playerId, action.targetPlayerId, action.royalCardIds);

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

    default: {
      const _exhaustive: never = action;
      return err(`Unknown action type`);
    }
  }
}
