import { effectiveHealth, getCard } from "./cards";
import type { CardId, GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";
import { spendVault } from "./vault";
import { canPlayCard, isDuelPhase, effectiveDuelPhase } from "./validation";
import { checkAndApplyCancellation } from "./attachments";
import { findPairAttackerIdForRoyal, markDuelPairResolved } from "./combat";
import { pushLifeEvent } from "./lifeEvents";

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
    const destroyedState: GameState = {
      ...afterCancel,
      abyss: result.abyss,
      players: {
        ...afterCancel.players,
        [targetPlayerId]: result.player,
      },
    };
    // A Club debuff that drops a Royal to <= 0 health kills it with no life
    // loss (Rule 6) — log it so the removal is attributed rather than silent.
    // The !finalRoyal case is a pip-cancellation removal, a different mechanic,
    // so it is left unlogged here.
    if (finalRoyal) {
      return ok(
        pushLifeEvent(destroyedState, {
          kind: "royal_destroyed",
          targetPlayerId,
          amount: 0,
          resultingLife: result.player.life,
          actorPlayerId: attackerPlayerId,
          sourceCardId: clubCardId,
          destroyedRoyalId: targetRoyalId,
        }),
      );
    }
    return ok(destroyedState);
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

  const targetPlayer = state.players[targetPlayerId];
  if (!targetPlayer) return err(`Player ${targetPlayerId} not found`);

  const player = state.players[playerId]!;
  const withoutCard = { ...player, hand: player.hand.filter((c) => c !== cardId) };
  const afterSpend = spendVault(withoutCard, card.vaultCost);

  if (!targetCardId) {
    // A killing face-burn opens the same respond_to_club window a Royal-Club
    // does, so the defender can heal (or accept) before the blow lands. No life
    // is deducted here — confirmClubResponse applies faceDamage.amount, after
    // which the dispatcher's applyStateBasedActions eliminates if still <= 0.
    // Non-lethal burns, and self-targeted ones, resolve immediately as before.
    const isSelf = targetPlayerId === playerId;
    if (!isSelf && targetPlayer.life - card.pipValue <= 0) {
      const returnPhase =
        state.phase === "interrupt_window"
          ? state.interruptStack?.returnPhase
          : isDuelPhase(state.phase) || state.phase === "declare_blocks"
            ? state.phase
            : undefined;
      return ok({
        ...state,
        phase: "respond_to_club",
        pendingClubDebuff: {
          attackerPlayerId: playerId,
          clubCardId: cardId,
          targetPlayerId,
          faceDamage: { sourceCardId: cardId, amount: card.pipValue },
          defenderDiamondUsed: false,
          returnPhase,
        },
        players: {
          ...state.players,
          [playerId]: afterSpend,
        },
      });
    }

    const baseTarget = isSelf ? afterSpend : targetPlayer;
    const damagedTarget: PlayerState = {
      ...baseTarget,
      life: Math.max(0, baseTarget.life - card.pipValue),
    };
    return ok(
      pushLifeEvent(
        {
          ...state,
          abyss: [...state.abyss, cardId],
          lastDirectHit: {
            sourceCardId: cardId,
            targetPlayerId,
            amount: card.pipValue,
            seq: (state.lastDirectHit?.seq ?? 0) + 1,
          },
          players: {
            ...state.players,
            [playerId]: afterSpend,
            [targetPlayerId]: damagedTarget,
          },
        },
        {
          kind: "club_damage",
          targetPlayerId,
          amount: card.pipValue,
          resultingLife: damagedTarget.life,
          actorPlayerId: playerId,
          sourceCardId: cardId,
        },
      ),
    );
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
    if (state.pendingClubDebuff?.returnPhase && isDuelPhase(state.pendingClubDebuff.returnPhase)) {
      const ctx = withPending.duelContext;
      if (ctx) {
        const currentDuelPairs = withPending.attacks.filter(
          (a) => a.targetPlayerId === ctx.defenderPlayerId,
        );
        const pairId = findPairAttackerIdForRoyal(currentDuelPairs, targetCardId);
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

  if (state.phase === "interrupt_window" && state.pendingClubDebuff) {
    // An interrupt Club played while a respond_to_club window is already open
    // resolves immediately. applyDebuffToRoyal always clears pendingClubDebuff,
    // so restore the underlying pending Club response that the window will
    // return to — otherwise the game returns to respond_to_club with no
    // pending payload and deadlocks confirmClubResponse.
    const result = applyDebuffToRoyal(
      { ...state, players: { ...state.players, [playerId]: afterSpend } },
      playerId,
      cardId,
      targetPlayerId,
      targetCardId,
    );
    if (!result.ok) return result;
    return ok({ ...result.value, pendingClubDebuff: state.pendingClubDebuff });
  }

  if (state.phase === "interrupt_window") {
    // A Club played as an interrupt targets a Royal: the Royal's owner gets
    // the standard respond_to_club window to react (heal, counter, etc.)
    // before the debuff lands. After they confirm, play returns to the phase
    // that was interrupted.
    const returnPhase = state.interruptStack?.returnPhase;
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

  if (state.phase === "declare_blocks") {
    // Immediate resolution during block declaration preserves combat flow.
    return applyDebuffToRoyal(
      { ...state, players: { ...state.players, [playerId]: afterSpend } },
      playerId,
      cardId,
      targetPlayerId,
      targetCardId,
    );
  }

  const returnPhase = isDuelPhase(state.phase) ? state.phase : undefined;

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

  // Lethal face-damage response: apply the stored damage now — a heal played
  // during the window has already raised the defender's life — then return to
  // the pre-window phase. The dispatcher runs applyStateBasedActions next, so a
  // target still at <= 0 is eliminated there, consistent with the 0-life rule.
  if (pending.faceDamage) {
    const target = state.players[pending.targetPlayerId];
    if (!target) return err(`Player ${pending.targetPlayerId} not found`);
    const { sourceCardId, amount } = pending.faceDamage;
    const damaged: PlayerState = {
      ...target,
      life: Math.max(0, target.life - amount),
    };
    return ok(
      pushLifeEvent(
        {
          ...state,
          phase: returnPhase,
          pendingClubDebuff: undefined,
          abyss: [...state.abyss, sourceCardId],
          lastDirectHit: {
            sourceCardId,
            targetPlayerId: pending.targetPlayerId,
            amount,
            seq: (state.lastDirectHit?.seq ?? 0) + 1,
          },
          players: {
            ...state.players,
            [pending.targetPlayerId]: damaged,
          },
        },
        {
          kind: getCard(sourceCardId).isJoker ? "joker_damage" : "club_damage",
          targetPlayerId: pending.targetPlayerId,
          amount,
          resultingLife: damaged.life,
          actorPlayerId: pending.attackerPlayerId,
          sourceCardId,
        },
      ),
    );
  }

  if (!pending.targetRoyalId) {
    return err("Pending club response has neither a target Royal nor face damage");
  }
  const targetRoyalId = pending.targetRoyalId;
  const result = applyDebuffToRoyal(
    { ...state, phase: returnPhase },
    pending.attackerPlayerId,
    pending.clubCardId,
    pending.targetPlayerId,
    targetRoyalId,
  );
  if (!result.ok) return result;

  if (isDuelPhase(returnPhase)) {
    // Only a duel participant's Club play resolves the duel pair. A Club
    // played as an interrupt by a third, uninvolved player debuffs the Royal
    // without ending the duel between the two participants.
    const ctx = state.duelContext;
    const attackerIsDuelParticipant =
      !!ctx &&
      (pending.attackerPlayerId === ctx.attackerPlayerId ||
        pending.attackerPlayerId === ctx.defenderPlayerId);
    if (attackerIsDuelParticipant) {
      return markDuelPairResolved(result.value, targetRoyalId);
    }
  }

  return result;
}

export const applyClubToRoyal = applyClub;
