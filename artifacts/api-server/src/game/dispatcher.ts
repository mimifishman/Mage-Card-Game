import type { GameState, Result } from "./types";
import type { GameAction } from "./actions";
import { err } from "./types";
import {
  playDiamondToMine,
  discardDiamondToDraw,
  discardDiamondForBoost,
  discardToAbyss,
  playRoyalToCourt,
  attachRoyalSupport,
  attachHeart,
  attachSpade,
  applyClub,
  playJokerDestroyRoyal,
  playJokerDamagePlayer,
  declareAttack,
  beginDeclareBlocks,
  declareBlock,
  resolveCombat,
  endTurn,
} from "./index";

export function dispatchAction(
  state: GameState,
  playerId: string,
  action: GameAction,
): Result<GameState> {
  switch (action.type) {
    case "play_diamond_to_mine":
      return playDiamondToMine(state, playerId, action.cardId);

    case "discard_diamond_to_draw":
      return discardDiamondToDraw(state, playerId, action.cardId);

    case "discard_diamond_for_boost":
      return discardDiamondForBoost(state, playerId, action.cardId);

    case "discard_to_abyss":
      return discardToAbyss(state, playerId, action.cardId);

    case "play_royal_to_court":
      return playRoyalToCourt(state, playerId, action.cardId);

    case "attach_royal_support":
      return attachRoyalSupport(state, playerId, action.supportCardId, action.targetRoyalId);

    case "attach_heart":
      return attachHeart(state, playerId, action.heartCardId, action.targetRoyalId);

    case "attach_spade":
      return attachSpade(state, playerId, action.spadeCardId, action.targetRoyalId);

    case "apply_club":
      return applyClub(
        state,
        playerId,
        action.clubCardId,
        action.targetPlayerId,
        action.targetRoyalId,
      );

    case "play_joker": {
      if (action.mode === "destroy_royal") {
        if (!action.targetPlayerId || !action.targetRoyalId) {
          return err("play_joker destroy_royal requires targetPlayerId and targetRoyalId");
        }
        return playJokerDestroyRoyal(state, playerId, action.cardId, action.targetPlayerId, action.targetRoyalId);
      } else {
        if (!action.targetPlayerId) {
          return err("play_joker damage_player requires targetPlayerId");
        }
        return playJokerDamagePlayer(state, playerId, action.cardId, action.targetPlayerId);
      }
    }

    case "declare_attack":
      return declareAttack(state, playerId, action.attackerRoyalId, action.targetPlayerId);

    case "begin_declare_blocks":
      return beginDeclareBlocks(state);

    case "declare_block":
      return declareBlock(state, playerId, action.blockerRoyalId, action.attackerRoyalId);

    case "resolve_combat":
      return resolveCombat(state);

    case "end_turn":
      return endTurn(state);

    default: {
      const _exhaustive: never = action;
      return err(`Unknown action type`);
    }
  }
}
