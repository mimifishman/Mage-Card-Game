import { getCard } from "./cards";
import type { CardId, GameState, PlayerState, Result, RoyalInCourt } from "./types";
import { err, ok } from "./types";
import { spendVault } from "./vault";
import { canPlayCard, getUnblockedAttackerRoyalIds } from "./validation";

function removeFromHand(player: PlayerState, cardId: CardId): PlayerState {
  return { ...player, hand: player.hand.filter((c) => c !== cardId) };
}

export function checkAndApplyCancellation(
  state: GameState,
  playerId: string,
  royalCardId: CardId,
): GameState {
  const player = state.players[playerId];
  if (!player) return state;

  const royalIdx = player.court.findIndex((r) => r.cardId === royalCardId);
  if (royalIdx === -1) return state;

  const royal = player.court[royalIdx]!;

  let spadePipTotal = 0;
  let clubPipTotal = 0;
  const heartIds: CardId[] = [];
  const spadeAndClubIds: CardId[] = [];

  for (const attachedId of royal.attachedCards) {
    const card = getCard(attachedId);
    if (card.suit === "S") {
      spadePipTotal += card.pipValue;
      spadeAndClubIds.push(attachedId);
    } else if (card.suit === "C") {
      clubPipTotal += card.pipValue;
      spadeAndClubIds.push(attachedId);
    } else if (card.suit === "H") {
      heartIds.push(attachedId);
    }
  }

  if (spadePipTotal === 0 || clubPipTotal === 0 || spadePipTotal !== clubPipTotal) {
    return state;
  }

  const heartBuffHealth = heartIds.reduce((sum, id) => {
    const c = getCard(id);
    return sum + c.pipValue;
  }, 0);

  const cancelledRoyal: RoyalInCourt = {
    ...royal,
    buffAttack: 0,
    buffHealth: heartBuffHealth,
    attachedCards: heartIds,
  };

  const updatedCourt = [...player.court];
  updatedCourt[royalIdx] = cancelledRoyal;

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, court: updatedCourt },
    },
    abyss: [...state.abyss, ...spadeAndClubIds],
  };
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

  const unblockedAttackers = getUnblockedAttackerRoyalIds(state);
  if (unblockedAttackers.has(targetCardId)) {
    return err("That Royal's attack is already unblocked — you cannot add more cards to it");
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

  const unblockedAttackers = getUnblockedAttackerRoyalIds(state);
  if (unblockedAttackers.has(targetCardId)) {
    return err("That Royal's attack is already unblocked — you cannot add more cards to it");
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

  const stateWithSpade: GameState = {
    ...state,
    players: { ...state.players, [playerId]: updated },
  };

  return ok(checkAndApplyCancellation(stateWithSpade, playerId, targetCardId));
}

export function discardHeartToHeal(
  state: GameState,
  playerId: string,
  heartCardId: CardId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, heartCardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const card = getCard(heartCardId);
  if (card.suit !== "H" || card.isRoyal) {
    return err(`Card ${heartCardId} is not a non-Royal Heart`);
  }

  const player = state.players[playerId]!;
  const afterSpend = spendVault(removeFromHand(player, heartCardId), card.vaultCost);
  const healed: PlayerState = {
    ...afterSpend,
    life: player.life + card.pipValue,
  };

  return ok({
    ...state,
    abyss: [...state.abyss, heartCardId],
    players: { ...state.players, [playerId]: healed },
  });
}

export function discardSpadeToReturn(
  state: GameState,
  playerId: string,
  spadeCardId: CardId,
  targetCardId: CardId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, spadeCardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const spadeCard = getCard(spadeCardId);
  if (spadeCard.suit !== "S" || spadeCard.isRoyal) {
    return err(`Card ${spadeCardId} is not a non-Royal Spade`);
  }

  if (!state.abyss.includes(targetCardId)) {
    return err(`Card ${targetCardId} is not in the Abyss`);
  }

  const targetCard = getCard(targetCardId);
  const effectiveTargetValue = targetCard.isJoker ? 10 : targetCard.pipValue;
  if (effectiveTargetValue > spadeCard.pipValue) {
    return err(
      `Card ${targetCardId} value (${effectiveTargetValue}) exceeds Spade value (${spadeCard.pipValue})`,
    );
  }

  const player = state.players[playerId]!;
  const afterSpend = spendVault(removeFromHand(player, spadeCardId), spadeCard.vaultCost);
  const updatedPlayer: PlayerState = {
    ...afterSpend,
    hand: [...afterSpend.hand, targetCardId],
  };

  return ok({
    ...state,
    abyss: [...state.abyss.filter((c) => c !== targetCardId), spadeCardId],
    players: { ...state.players, [playerId]: updatedPlayer },
  });
}
