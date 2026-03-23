import { getCard } from "./cards";
import type { CardId, GameState, PlayerState, Result, RoyalInCourt } from "./types";
import { err, ok } from "./types";
import { spendVault } from "./vault";
import { canPlayCard } from "./validation";

function removeFromHand(player: PlayerState, cardId: CardId): PlayerState {
  return { ...player, hand: player.hand.filter((c) => c !== cardId) };
}

export function attachHeart(
  state: GameState,
  playerId: string,
  cardId: CardId,
  targetCardId: CardId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, cardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const card = getCard(cardId);
  if (card.suit !== "H" || card.isRoyal) {
    return err(`Card ${cardId} is not a non-Royal Heart`);
  }

  const player = state.players[playerId]!;
  const targetIdx = player.court.findIndex((r) => r.cardId === targetCardId);
  if (targetIdx === -1) {
    return err(`Target Royal ${targetCardId} is not in your Court`);
  }

  const target = player.court[targetIdx]!;
  const updatedTarget: RoyalInCourt = {
    ...target,
    buffHealth: target.buffHealth + card.pipValue,
    attachedCards: [...target.attachedCards, cardId],
  };

  const updatedCourt = [...player.court];
  updatedCourt[targetIdx] = updatedTarget;

  const afterSpend = spendVault(removeFromHand(player, cardId), card.vaultCost);
  const updated: PlayerState = { ...afterSpend, court: updatedCourt };

  return ok({
    ...state,
    players: { ...state.players, [playerId]: updated },
  });
}

export function attachSpade(
  state: GameState,
  playerId: string,
  cardId: CardId,
  targetCardId: CardId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, cardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const card = getCard(cardId);
  if (card.suit !== "S" || card.isRoyal) {
    return err(`Card ${cardId} is not a non-Royal Spade`);
  }

  const player = state.players[playerId]!;
  const targetIdx = player.court.findIndex((r) => r.cardId === targetCardId);
  if (targetIdx === -1) {
    return err(`Target Royal ${targetCardId} is not in your Court`);
  }

  const target = player.court[targetIdx]!;
  const updatedTarget: RoyalInCourt = {
    ...target,
    buffAttack: target.buffAttack + card.pipValue,
    buffHealth: target.buffHealth + card.pipValue,
    attachedCards: [...target.attachedCards, cardId],
  };

  const updatedCourt = [...player.court];
  updatedCourt[targetIdx] = updatedTarget;

  const afterSpend = spendVault(removeFromHand(player, cardId), card.vaultCost);
  const updated: PlayerState = { ...afterSpend, court: updatedCourt };

  return ok({
    ...state,
    players: { ...state.players, [playerId]: updated },
  });
}
