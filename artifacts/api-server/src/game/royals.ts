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
  if (state.phase === "declare_blocks") {
    return err(`Cannot play a Royal to Court during phase "declare_blocks"`);
  }
  if (state.phase === "respond_to_club") {
    return err(`Cannot play Royals to Court during a Club response window`);
  }

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
  _state: GameState,
  _playerId: string,
  _supportCardId: CardId,
  _targetCardId: CardId,
): Result<GameState> {
  return err("Royals cannot be attached to other Royals.");

  // The code below is preserved for potential future reversal.
  /* eslint-disable no-unreachable */
  const canPlay = canPlayCard(_state, _playerId, _supportCardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const supportCard = getCard(_supportCardId);
  if (!supportCard.isRoyal) {
    return err(`Card ${_supportCardId} is not a Royal — cannot be played as support`);
  }

  const player = _state.players[_playerId]!;
  const targetIdx = player.court.findIndex((r) => r.cardId === _targetCardId);
  if (targetIdx === -1) {
    return err(`Target Royal ${_targetCardId} is not in your Court`);
  }

  const target = player.court[targetIdx]!;
  const buff = royalSupportBuff(supportCard.rank as Rank);

  const updatedTarget: RoyalInCourt = {
    ...target,
    buffAttack: target.buffAttack + buff.attack,
    buffHealth: target.buffHealth + buff.health,
    attachedCards: [...target.attachedCards, _supportCardId],
  };

  const updatedCourt = [...player.court];
  updatedCourt[targetIdx] = updatedTarget;

  const afterSpend = spendVault(removeFromHand(player, _supportCardId), supportCard.vaultCost);
  const updated: PlayerState = {
    ...afterSpend,
    court: updatedCourt,
  };

  const updatedAttacks = _state.attacks.filter(
    (a) => a.attackerCardId !== _supportCardId,
  );

  return ok({
    ..._state,
    attacks: updatedAttacks,
    players: { ..._state.players, [_playerId]: updated },
  });
  /* eslint-enable no-unreachable */
}
