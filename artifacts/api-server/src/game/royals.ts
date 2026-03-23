import { getCard, royalSupportBuff } from "./cards";
import type { CardId, GameState, PlayerState, Rank, Result, RoyalInCourt } from "./types";
import { err, ok } from "./types";
import { spendVault } from "./vault";
import { canPlayCard } from "./validation";

function removeFromHand(player: PlayerState, cardId: CardId): PlayerState {
  return { ...player, hand: player.hand.filter((c) => c !== cardId) };
}

export function playRoyalToCourt(
  state: GameState,
  playerId: string,
  cardId: CardId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, cardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const card = getCard(cardId);
  if (!card.isRoyal) {
    return err(`Card ${cardId} is not a Royal`);
  }

  const player = state.players[playerId]!;

  const newRoyal: RoyalInCourt = {
    cardId,
    hasAttackedThisTurn: false,
    hasteLocked: true,
    damageTaken: 0,
    buffAttack: 0,
    buffHealth: 0,
    attachedCards: [],
  };

  const afterSpend = spendVault(removeFromHand(player, cardId), card.vaultCost);
  const updated: PlayerState = {
    ...afterSpend,
    court: [...afterSpend.court, newRoyal],
  };

  return ok({
    ...state,
    players: { ...state.players, [playerId]: updated },
  });
}

export function attachRoyalSupport(
  state: GameState,
  playerId: string,
  supportCardId: CardId,
  targetCardId: CardId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, supportCardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const supportCard = getCard(supportCardId);
  if (!supportCard.isRoyal) {
    return err(`Card ${supportCardId} is not a Royal — cannot be played as support`);
  }

  const player = state.players[playerId]!;
  const targetIdx = player.court.findIndex((r) => r.cardId === targetCardId);
  if (targetIdx === -1) {
    return err(`Target Royal ${targetCardId} is not in your Court`);
  }

  const target = player.court[targetIdx]!;
  const buff = royalSupportBuff(supportCard.rank as Rank);

  const updatedTarget: RoyalInCourt = {
    ...target,
    buffAttack: target.buffAttack + buff.attack,
    buffHealth: target.buffHealth + buff.health,
    attachedCards: [...target.attachedCards, supportCardId],
  };

  const updatedCourt = [...player.court];
  updatedCourt[targetIdx] = updatedTarget;

  const afterSpend = spendVault(removeFromHand(player, supportCardId), supportCard.vaultCost);
  const updated: PlayerState = {
    ...afterSpend,
    court: updatedCourt,
  };

  return ok({
    ...state,
    players: { ...state.players, [playerId]: updated },
  });
}
