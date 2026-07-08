import { getCard } from "./cards";
import type { CardId, GameState, PlayerState, Result, RoyalInCourt } from "./types";
import { err, ok } from "./types";
import { spendVault } from "./vault";
import { canPlayCard } from "./validation";

function removeFromHand(player: PlayerState, cardId: CardId): PlayerState {
  return { ...player, hand: player.hand.filter((c) => c !== cardId) };
}

function getSubsets(cards: { id: CardId; pip: number }[]): Array<{ indices: number[]; sum: number }> {
  const result: Array<{ indices: number[]; sum: number }> = [];
  const n = cards.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const indices: number[] = [];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        indices.push(i);
        sum += cards[i]!.pip;
      }
    }
    result.push({ indices, sum });
  }
  return result;
}

function findMaxCancellation(
  spades: { id: CardId; pip: number }[],
  clubs: { id: CardId; pip: number }[],
): { cancelledSpadeIndices: Set<number>; cancelledClubIndices: Set<number> } {
  const spadeSubsets = getSubsets(spades);
  const clubBySum = new Map<number, Array<number[]>>();
  for (const cs of getSubsets(clubs)) {
    if (!clubBySum.has(cs.sum)) clubBySum.set(cs.sum, []);
    clubBySum.get(cs.sum)!.push(cs.indices);
  }

  const pairs: Array<{ si: number[]; ci: number[] }> = [];
  for (const ss of spadeSubsets) {
    for (const ci of clubBySum.get(ss.sum) ?? []) {
      pairs.push({ si: ss.indices, ci });
    }
  }

  let bestSpade = new Set<number>();
  let bestClub = new Set<number>();

  function backtrack(pairIdx: number, usedSpade: Set<number>, usedClub: Set<number>) {
    const total = usedSpade.size + usedClub.size;
    if (total > bestSpade.size + bestClub.size) {
      bestSpade = new Set(usedSpade);
      bestClub = new Set(usedClub);
    }
    for (let i = pairIdx; i < pairs.length; i++) {
      const pair = pairs[i]!;
      if (pair.si.some((idx) => usedSpade.has(idx))) continue;
      if (pair.ci.some((idx) => usedClub.has(idx))) continue;
      for (const idx of pair.si) usedSpade.add(idx);
      for (const idx of pair.ci) usedClub.add(idx);
      backtrack(i + 1, usedSpade, usedClub);
      for (const idx of pair.si) usedSpade.delete(idx);
      for (const idx of pair.ci) usedClub.delete(idx);
    }
  }

  backtrack(0, new Set(), new Set());
  return { cancelledSpadeIndices: bestSpade, cancelledClubIndices: bestClub };
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

  const spades: { id: CardId; pip: number }[] = [];
  const clubs: { id: CardId; pip: number }[] = [];

  for (const attachedId of royal.attachedCards) {
    const card = getCard(attachedId);
    if (card.suit === "S") {
      spades.push({ id: attachedId, pip: card.pipValue });
    } else if (card.suit === "C") {
      clubs.push({ id: attachedId, pip: card.pipValue });
    }
  }

  if (spades.length === 0 || clubs.length === 0) return state;

  const { cancelledSpadeIndices, cancelledClubIndices } = findMaxCancellation(spades, clubs);

  if (cancelledSpadeIndices.size === 0) return state;

  const cancelledIds = new Set<CardId>([
    ...[...cancelledSpadeIndices].map((i) => spades[i]!.id),
    ...[...cancelledClubIndices].map((i) => clubs[i]!.id),
  ]);

  const remainingAttached = royal.attachedCards.filter((id) => !cancelledIds.has(id));

  let buffAttack = 0;
  let buffHealth = 0;
  for (const id of remainingAttached) {
    const card = getCard(id);
    if (card.suit === "S") {
      buffAttack += card.pipValue;
      buffHealth += card.pipValue;
    } else if (card.suit === "C") {
      buffAttack -= card.pipValue;
      buffHealth -= card.pipValue;
    } else if (card.suit === "H") {
      buffHealth += card.pipValue;
    }
  }

  const updatedRoyal: RoyalInCourt = {
    ...royal,
    buffAttack,
    buffHealth,
    attachedCards: remainingAttached,
  };

  const updatedCourt = [...player.court];
  updatedCourt[royalIdx] = updatedRoyal;

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, court: updatedCourt },
    },
    abyss: [...state.abyss, ...cancelledIds],
  };
}

export function attachHeart(
  state: GameState,
  playerId: string,
  cardId: CardId,
  targetCardId: CardId,
  targetPlayerId: string = playerId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, cardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const card = getCard(cardId);
  if (card.suit !== "H" || card.isRoyal) {
    return err(`Card ${cardId} is not a non-Royal Heart`);
  }

  const targetPlayer = state.players[targetPlayerId];
  if (!targetPlayer) return err(`Player ${targetPlayerId} not found`);

  const targetIdx = targetPlayer.court.findIndex((r) => r.cardId === targetCardId);
  if (targetIdx === -1) {
    return err(`Target Royal ${targetCardId} is not in ${targetPlayerId}'s Court`);
  }

  const target = targetPlayer.court[targetIdx]!;
  const updatedTarget: RoyalInCourt = {
    ...target,
    buffHealth: target.buffHealth + card.pipValue,
    attachedCards: [...target.attachedCards, cardId],
  };

  const updatedCourt = [...targetPlayer.court];
  updatedCourt[targetIdx] = updatedTarget;

  const player = state.players[playerId]!;
  const afterSpend = spendVault(removeFromHand(player, cardId), card.vaultCost);

  if (targetPlayerId === playerId) {
    const updated: PlayerState = { ...afterSpend, court: updatedCourt };
    return ok({
      ...state,
      players: { ...state.players, [playerId]: updated },
    });
  }

  const updatedTargetPlayer: PlayerState = { ...targetPlayer, court: updatedCourt };

  return ok({
    ...state,
    players: {
      ...state.players,
      [playerId]: afterSpend,
      [targetPlayerId]: updatedTargetPlayer,
    },
  });
}

export function attachSpade(
  state: GameState,
  playerId: string,
  cardId: CardId,
  targetCardId: CardId,
  targetPlayerId: string = playerId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, cardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const card = getCard(cardId);
  if (card.suit !== "S" || card.isRoyal) {
    return err(`Card ${cardId} is not a non-Royal Spade`);
  }

  const targetPlayer = state.players[targetPlayerId];
  if (!targetPlayer) return err(`Player ${targetPlayerId} not found`);

  const targetIdx = targetPlayer.court.findIndex((r) => r.cardId === targetCardId);
  if (targetIdx === -1) {
    return err(`Target Royal ${targetCardId} is not in ${targetPlayerId}'s Court`);
  }

  const target = targetPlayer.court[targetIdx]!;
  const updatedTarget: RoyalInCourt = {
    ...target,
    buffAttack: target.buffAttack + card.pipValue,
    buffHealth: target.buffHealth + card.pipValue,
    attachedCards: [...target.attachedCards, cardId],
  };

  const updatedCourt = [...targetPlayer.court];
  updatedCourt[targetIdx] = updatedTarget;

  const player = state.players[playerId]!;
  const afterSpend = spendVault(removeFromHand(player, cardId), card.vaultCost);

  let stateWithSpade: GameState;
  if (targetPlayerId === playerId) {
    const updated: PlayerState = { ...afterSpend, court: updatedCourt };
    stateWithSpade = {
      ...state,
      players: { ...state.players, [playerId]: updated },
    };
  } else {
    const updatedTargetPlayer: PlayerState = { ...targetPlayer, court: updatedCourt };
    stateWithSpade = {
      ...state,
      players: {
        ...state.players,
        [playerId]: afterSpend,
        [targetPlayerId]: updatedTargetPlayer,
      },
    };
  }

  return ok(checkAndApplyCancellation(stateWithSpade, targetPlayerId, targetCardId));
}

export function discardHeartToHeal(
  state: GameState,
  playerId: string,
  heartCardId: CardId,
  targetPlayerId: string = playerId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, heartCardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const card = getCard(heartCardId);
  if (card.suit !== "H" || card.isRoyal) {
    return err(`Card ${heartCardId} is not a non-Royal Heart`);
  }

  const targetPlayer = state.players[targetPlayerId];
  if (!targetPlayer) {
    return err(`Target player ${targetPlayerId} not found`);
  }

  if (targetPlayerId === playerId) {
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

  const player = state.players[playerId]!;
  const afterSpend = spendVault(removeFromHand(player, heartCardId), card.vaultCost);
  const healed: PlayerState = {
    ...targetPlayer,
    life: targetPlayer.life + card.pipValue,
  };

  return ok({
    ...state,
    abyss: [...state.abyss, heartCardId],
    players: {
      ...state.players,
      [playerId]: afterSpend,
      [targetPlayerId]: healed,
    },
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
