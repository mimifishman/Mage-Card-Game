import { effectiveHealth, getCard } from "./cards";
import type { CardId, GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";
import { spendVault } from "./vault";
import { canPlayCard, isDuelPhase } from "./validation";
import { checkAndApplyCancellation } from "./attachments";
import {
  findPairAttackerIdForRoyal,
  isRoyalInActiveDuelPair,
  isRoyalInResolvedDuelPair,
  markDuelPairResolved,
} from "./combat";

function destroyRoyalToAbyss(
  player: PlayerState,
  royalCardId: CardId,
  abyss: CardId[],
): { player: PlayerState; abyss: CardId[] } {
  const royal = player.court.find((r) => r.cardId === royalCardId);
  if (!royal) return { player, abyss };
  const destroyed = [royal.cardId, ...royal.attachedCards];
  return {
    player: {
      ...player,
      court: player.court.filter((r) => r.cardId !== royalCardId),
    },
    abyss: [...abyss, ...destroyed],
  };
}

function applyDebuffToRoyal(
  state: GameState,
  attackerPlayerId: string,
  clubCardId: CardId,
  targetPlayerId: string,
  targetRoyalId: CardId,
): Result<GameState> {
  const card = getCard(clubCardId);
  const targetPlayer = state.players[targetPlayerId];
  if (!targetPlayer) return err(`Player ${targetPlayerId} not found`);

  const royalIdx = targetPlayer.court.findIndex((r) => r.cardId === targetRoyalId);
  if (royalIdx === -1) {
    return err(`Royal ${targetRoyalId} is not in ${targetPlayerId}'s Court`);
  }

  const royal = targetPlayer.court[royalIdx]!;
  const debuffedRoyal = {
    ...royal,
    buffAttack: royal.buffAttack - card.pipValue,
    buffHealth: royal.buffHealth - card.pipValue,
    attachedCards: [...royal.attachedCards, clubCardId],
  };

  const updatedCourt = [...targetPlayer.court];
  updatedCourt[royalIdx] = debuffedRoyal;
  const updatedTargetPlayer = { ...targetPlayer, court: updatedCourt };

  const stateWithDebuff: GameState = {
    ...state,
    pendingClubDebuff: undefined,
    players: {
      ...state.players,
      [attackerPlayerId]: state.players[attackerPlayerId]!,
      [targetPlayerId]: updatedTargetPlayer,
    },
  };

  const afterCancel = checkAndApplyCancellation(stateWithDebuff, targetPlayerId, targetRoyalId);

  const finalTargetPlayer = afterCancel.players[targetPlayerId]!;
  const finalRoyal = finalTargetPlayer.court.find((r) => r.cardId === targetRoyalId);

  if (!finalRoyal || effectiveHealth(finalRoyal) <= 0) {
    const result = destroyRoyalToAbyss(finalTargetPlayer, targetRoyalId, afterCancel.abyss);
    return ok({
      ...afterCancel,
      abyss: result.abyss,
      players: {
        ...afterCancel.players,
        [targetPlayerId]: result.player,
      },
    });
  }

  return ok(afterCancel);
}

export function applyClub(
  state: GameState,
  playerId: string,
  cardId: CardId,
  targetPlayerId: string,
  targetCardId?: CardId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, cardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const card = getCard(cardId);
  if (card.suit !== "C" || card.isRoyal) {
    return err(`Card ${cardId} is not a non-Royal Club`);
  }
  if (targetPlayerId === playerId) {
    return err("Cannot use Club on yourself");
  }

  const targetPlayer = state.players[targetPlayerId];
  if (!targetPlayer) return err(`Player ${targetPlayerId} not found`);

  const player = state.players[playerId]!;
  const withoutCard = { ...player, hand: player.hand.filter((c) => c !== cardId) };
  const afterSpend = spendVault(withoutCard, card.vaultCost);

  if (!targetCardId) {
    const damagedTarget: PlayerState = {
      ...targetPlayer,
      life: Math.max(0, targetPlayer.life - card.pipValue),
    };
    return ok({
      ...state,
      abyss: [...state.abyss, cardId],
      players: {
        ...state.players,
        [playerId]: afterSpend,
        [targetPlayerId]: damagedTarget,
      },
    });
  }

  const royalIdx = targetPlayer.court.findIndex((r) => r.cardId === targetCardId);
  if (royalIdx === -1) {
    return err(`Royal ${targetCardId} is not in ${targetPlayerId}'s Court`);
  }

  if (state.phase === "respond_to_club") {
    const result = applyDebuffToRoyal(
      { ...state, players: { ...state.players, [playerId]: afterSpend } },
      playerId,
      cardId,
      targetPlayerId,
      targetCardId,
    );
    if (!result.ok) return result;

    let withPending = { ...result.value, pendingClubDebuff: state.pendingClubDebuff };

    // If this respond_to_club window originated from a duel, the counter-Club
    // debuff lands during the duel — mark that pair as resolved immediately
    // (without triggering combat; confirmClubResponse handles final resolution).
    if (isDuelPhase(state.pendingClubDebuff?.returnPhase)) {
      const ctx = withPending.duelContext;
      if (ctx) {
        const pairId = findPairAttackerIdForRoyal(withPending.attacks, targetCardId);
        if (pairId) {
          const resolved = ctx.resolvedPairAttackerIds ?? [];
          if (!resolved.includes(pairId)) {
            withPending = {
              ...withPending,
              duelContext: {
                ...ctx,
                resolvedPairAttackerIds: [...resolved, pairId],
              },
            };
          }
        }
      }
    }

    return ok(withPending);
  }

  if (state.phase === "declare_blocks") {
    return applyDebuffToRoyal(
      { ...state, players: { ...state.players, [playerId]: afterSpend } },
      playerId,
      cardId,
      targetPlayerId,
      targetCardId,
    );
  }

  const returnPhase = isDuelPhase(state.phase) ? state.phase : undefined;

  if (isDuelPhase(state.phase) && state.attacks.some((a) => a.blockerCardIds?.length)) {
    if (!isRoyalInActiveDuelPair(state, targetCardId)) {
      if (isRoyalInResolvedDuelPair(state, targetCardId)) {
        return err("Cannot target a Royal in a pair whose duel has already ended");
      }
      return err("Can only target a Royal that is part of an active duel pair");
    }
  }

  return ok({
    ...state,
    phase: "respond_to_club",
    pendingClubDebuff: {
      attackerPlayerId: playerId,
      clubCardId: cardId,
      targetPlayerId,
      targetRoyalId: targetCardId,
      defenderDiamondUsed: false,
      returnPhase,
    },
    players: {
      ...state.players,
      [playerId]: afterSpend,
    },
  });
}

export function confirmClubResponse(
  state: GameState,
  playerId: string,
): Result<GameState> {
  if (state.phase !== "respond_to_club") {
    return err(`Cannot confirm club response outside of respond_to_club phase`);
  }

  const pending = state.pendingClubDebuff;
  if (!pending) {
    return err("No pending club debuff to confirm");
  }

  if (playerId !== pending.targetPlayerId) {
    return err("Only the defending player can confirm the club response");
  }

  const returnPhase = pending.returnPhase ?? "main";
  const result = applyDebuffToRoyal(
    { ...state, phase: returnPhase },
    pending.attackerPlayerId,
    pending.clubCardId,
    pending.targetPlayerId,
    pending.targetRoyalId,
  );
  if (!result.ok) return result;

  if (isDuelPhase(returnPhase)) {
    return markDuelPairResolved(result.value, pending.targetRoyalId);
  }

  return result;
}

export const applyClubToRoyal = applyClub;
