import { effectiveAttack, effectiveHealth, getCard } from "./cards";
import type {
  AttackDeclaration,
  AttackTargetGroup,
  CardId,
  CombatPairOutcome,
  CombatSummary,
  DuelContext,
  GameState,
  LifeEvent,
  PlayerState,
  Result,
  RoyalInCourt,
} from "./types";
import { err, ok } from "./types";
import { availableVault } from "./vault";
import { pushLifeEvent } from "./lifeEvents";


export function activePlayers(state: GameState): string[] {
  return state.turnOrder.filter((id) => !state.players[id]?.isEliminated);
}

/**
 * Returns true if the player has at least one non-Royal card they can
 * legally act on during a duel turn.
 *
 * "Actionable" means the player has enough vault to satisfy the card's cost —
 * every duel action (attachHeart, discardHeartToHeal, discardToAbyss, etc.)
 * goes through canPlayCard which rejects cards whose vaultCost exceeds available
 * vault. A card with sufficient vault always has at least one valid duel action
 * (e.g. discard_to_abyss), even when the attacker's Royals are all unblocked.
 */
function hasDuelPlayableCard(player: PlayerState, state: GameState): boolean {
  const vault = availableVault(state.mine, player);
  return player.hand.some((cardId) => {
    const card = getCard(cardId);
    return !card.isRoyal && vault >= card.vaultCost;
  });
}

export function declareAttack(
  state: GameState,
  attackerPlayerId: string,
  targets: AttackTargetGroup[],
): Result<GameState> {
  if (state.activePlayerId !== attackerPlayerId) {
    return err("It is not your turn");
  }
  if (state.phase !== "main") {
    return err(`Cannot declare attack during phase "${state.phase}". Must be in "main".`);
  }
  if (state.hasAttackedThisTurn) {
    return err("You have already attacked this turn");
  }
  if (targets.length === 0) {
    return err("Must select at least one opponent to attack");
  }

  const targetPlayerIds = targets.map((t) => t.targetPlayerId);
  if (new Set(targetPlayerIds).size !== targetPlayerIds.length) {
    return err("Cannot assign more than one attack group to the same opponent");
  }

  const allRoyalIds = targets.flatMap((t) => t.royalCardIds);
  if (allRoyalIds.length === 0) {
    return err("Must select at least one Royal to attack with");
  }
  if (new Set(allRoyalIds).size !== allRoyalIds.length) {
    return err("Duplicate Royal IDs in attack selection — each Royal can only attack once, and can't be assigned to more than one opponent");
  }

  const attacker = state.players[attackerPlayerId];
  if (!attacker) return err(`Player ${attackerPlayerId} not found`);

  for (const target of targets) {
    if (target.royalCardIds.length === 0) {
      return err(`Must assign at least one Royal to attack ${target.targetPlayerId}`);
    }
    if (target.targetPlayerId === attackerPlayerId) {
      return err("Cannot attack yourself");
    }

    const targetPlayer = state.players[target.targetPlayerId];
    if (!targetPlayer) return err(`Player ${target.targetPlayerId} not found`);
    if (targetPlayer.isEliminated) return err(`Player ${target.targetPlayerId} is eliminated`);

    for (const royalId of target.royalCardIds) {
      const royal = attacker.court.find((r) => r.cardId === royalId);
      if (!royal) {
        return err(`Royal ${royalId} is not in your Court`);
      }
      if (royal.hasteLocked) {
        return err(`Royal ${royalId} is haste-locked and cannot attack`);
      }
      if (royal.hasAttackedThisTurn) {
        return err(`Royal ${royalId} has already attacked this turn`);
      }
    }
  }

  const selectedIds = new Set(allRoyalIds);
  const updatedCourt = attacker.court.map((r) =>
    selectedIds.has(r.cardId)
      ? { ...r, hasAttackedThisTurn: true }
      : r,
  );
  const updatedAttacker: PlayerState = { ...attacker, court: updatedCourt };

  const newAttacks: AttackDeclaration[] = targets.flatMap((target) =>
    target.royalCardIds.map((royalId) => ({
      attackerPlayerId,
      attackerCardId: royalId,
      targetPlayerId: target.targetPlayerId,
    })),
  );

  return ok({
    ...state,
    phase: "declare_blocks",
    hasAttackedThisTurn: true,
    players: { ...state.players, [attackerPlayerId]: updatedAttacker },
    attacks: newAttacks,
    pendingBlockDefenders: targetPlayerIds,
  });
}

export function confirmDeclareBlocks(
  state: GameState,
  defenderPlayerId: string,
  blocks: Record<CardId, CardId[] | "pass">,
): Result<GameState> {
  if (state.phase !== "declare_blocks") {
    return err(`Can only confirm blocks during "declare_blocks" phase`);
  }

  const pendingDefenders =
    state.pendingBlockDefenders ?? Array.from(new Set(state.attacks.map((a) => a.targetPlayerId)));

  if (!pendingDefenders.includes(defenderPlayerId)) {
    return err("You have already submitted your blocks, or no attacks are targeting you");
  }

  const incomingAttacks = state.attacks.filter((a) => a.targetPlayerId === defenderPlayerId);
  if (incomingAttacks.length === 0) {
    return err("No attacks targeting you to block");
  }

  const defender = state.players[defenderPlayerId];
  if (!defender) return err(`Player ${defenderPlayerId} not found`);

  const blockerUsed = new Set<CardId>();
  const updatedAttacks: AttackDeclaration[] = [...state.attacks];

  for (const attack of incomingAttacks) {
    const assignment = blocks[attack.attackerCardId];
    if (assignment === undefined) {
      return err(`No block assignment provided for attacking Royal ${attack.attackerCardId}`);
    }

    const attackIdx = updatedAttacks.findIndex((a) => a.attackerCardId === attack.attackerCardId && a.targetPlayerId === defenderPlayerId);
    if (attackIdx === -1) continue;

    if (assignment === "pass") {
      updatedAttacks[attackIdx] = { ...updatedAttacks[attackIdx]!, passed: true };
    } else {
      for (const blockerId of assignment) {
        const blockerRoyal = defender.court.find((r) => r.cardId === blockerId);
        if (!blockerRoyal) {
          return err(`Blocker ${blockerId} is not in your Court`);
        }
        if (blockerRoyal.hasAttackedThisTurn) {
          return err(`Blocker ${blockerId} has already attacked this turn and cannot block`);
        }
        if (blockerUsed.has(blockerId)) {
          return err(`Blocker ${blockerId} is already used for another attack`);
        }
        blockerUsed.add(blockerId);
      }
      updatedAttacks[attackIdx] = { ...updatedAttacks[attackIdx]!, blockerCardIds: assignment };
    }
  }

  const remainingPending = pendingDefenders.filter((id) => id !== defenderPlayerId);

  const stateAfterThisDefender: GameState = {
    ...state,
    attacks: updatedAttacks,
    pendingBlockDefenders: remainingPending,
  };

  if (remainingPending.length > 0) {
    // Other targeted opponents still need to submit their blocks (or pass)
    // independently before any fights can begin.
    return ok(stateAfterThisDefender);
  }

  return beginCombatResolution(stateAfterThisDefender);
}

/**
 * Called once every targeted opponent has submitted blocks (or passed).
 * Resolves unblocked hits immediately across every target, then enters the
 * duel for the first opponent with a blocked pair (queuing the rest, in the
 * order the opponents were targeted, to be resolved one at a time).
 */
function beginCombatResolution(state: GameState): Result<GameState> {
  const attackerPlayerId = state.attacks[0]?.attackerPlayerId;
  if (!attackerPlayerId) {
    return ok({ ...state, phase: "main", attacks: [], pendingBlockDefenders: undefined, lastCombatSummary: undefined });
  }

  const { players, immediateHits, preResolvedIds, lifeEvents } = computeImmediateUnblockedHits(state);

  let stateWithImmediateHits: GameState = {
    ...state,
    players,
    pendingBlockDefenders: undefined,
    lastCombatSummary: undefined,
  };
  for (const ev of lifeEvents) {
    stateWithImmediateHits = pushLifeEvent(stateWithImmediateHits, ev);
  }

  const blockedDefenderIds: string[] = [];
  for (const attack of state.attacks) {
    if (attack.blockerCardIds?.length && !blockedDefenderIds.includes(attack.targetPlayerId)) {
      blockedDefenderIds.push(attack.targetPlayerId);
    }
  }

  if (blockedDefenderIds.length === 0) {
    let players2 = { ...stateWithImmediateHits.players };
    let abyss2 = [...stateWithImmediateHits.abyss];
    for (const playerId of activePlayers(stateWithImmediateHits)) {
      const result = removeDeadRoyals(players2[playerId]!, abyss2);
      players2[playerId] = result.player;
      abyss2 = result.abyss;
    }

    return ok({
      ...stateWithImmediateHits,
      phase: "main",
      players: players2,
      abyss: abyss2,
      attacks: [],
      duelContext: undefined,
      duelQueue: undefined,
      lastCombatSummary: {
        pairs: buildCombatSummary(stateWithImmediateHits, stateWithImmediateHits.attacks),
        autoPassedPlayerIds: undefined,
        immediateHits: immediateHits.length ? immediateHits : undefined,
      },
    });
  }

  const [firstDefenderId, ...restQueue] = blockedDefenderIds;
  const relevantAttacks = stateWithImmediateHits.attacks.filter((a) => a.targetPlayerId === firstDefenderId);
  const hasMultiBlocker = relevantAttacks.some((a) => a.blockerCardIds && a.blockerCardIds.length > 1);

  const duelContext: DuelContext = {
    attackerPlayerId,
    defenderPlayerId: firstDefenderId!,
    duelAttackerPassed: false,
    duelBlockerPassed: false,
    attackerDiamondUsed: false,
    defenderDiamondUsed: false,
    resolvedPairAttackerIds: [],
    preResolvedUnblockedAttackerIds: preResolvedIds,
    immediateHits,
  };

  const nextState: GameState = {
    ...stateWithImmediateHits,
    duelContext,
    duelQueue: restQueue,
    phase: hasMultiBlocker ? "assign_damage_order" : "duel_blocker_turn",
  };

  if (hasMultiBlocker) return ok(nextState);
  return autoAdvanceDuelIfNeeded(nextState);
}

/**
 * Advances the sequential duel queue to the next targeted opponent once the
 * current opponent's fight has fully resolved. Carries over the global
 * immediate-hit bookkeeping (computed once for the whole multi-target attack)
 * so it keeps surfacing correctly in the final combined combat summary.
 */
function enterNextDuel(
  state: GameState,
  attackerPlayerId: string,
  defenderPlayerId: string,
  restQueue: string[],
): Result<GameState> {
  const prevCtx = state.duelContext!;
  const relevantAttacks = state.attacks.filter((a) => a.targetPlayerId === defenderPlayerId);
  const hasMultiBlocker = relevantAttacks.some((a) => a.blockerCardIds && a.blockerCardIds.length > 1);

  const newDuelContext: DuelContext = {
    attackerPlayerId,
    defenderPlayerId,
    duelAttackerPassed: false,
    duelBlockerPassed: false,
    attackerDiamondUsed: false,
    defenderDiamondUsed: false,
    resolvedPairAttackerIds: [],
    preResolvedUnblockedAttackerIds: prevCtx.preResolvedUnblockedAttackerIds,
    immediateHits: prevCtx.immediateHits,
  };

  const nextState: GameState = {
    ...state,
    duelContext: newDuelContext,
    duelQueue: restQueue,
    phase: hasMultiBlocker ? "assign_damage_order" : "duel_blocker_turn",
  };

  if (hasMultiBlocker) return ok(nextState);
  return autoAdvanceDuelIfNeeded(nextState);
}

export function setDamageOrder(
  state: GameState,
  attackerPlayerId: string,
  assignments: Record<CardId, CardId[]>,
): Result<GameState> {
  if (state.phase !== "assign_damage_order") {
    return err(`Can only set damage order during "assign_damage_order" phase`);
  }

  const ctx = state.duelContext;
  if (!ctx) return err("No duel context found");

  if (attackerPlayerId !== ctx.attackerPlayerId) {
    return err("Only the attacker can set the damage order");
  }

  const multiBlockerAttacks = state.attacks.filter(
    (a) =>
      a.targetPlayerId === ctx.defenderPlayerId &&
      a.blockerCardIds &&
      a.blockerCardIds.length > 1,
  );

  for (const attack of multiBlockerAttacks) {
    const order = assignments[attack.attackerCardId];
    if (!order) {
      return err(
        `Missing damage order for attacker ${attack.attackerCardId}. Must provide an order for every multi-blocker attack.`,
      );
    }
    const blockerSet = new Set(attack.blockerCardIds!);
    const orderSet = new Set(order);
    if (
      order.length !== attack.blockerCardIds!.length ||
      !order.every((id) => blockerSet.has(id)) ||
      !attack.blockerCardIds!.every((id) => orderSet.has(id))
    ) {
      return err(
        `Invalid damage order for attacker ${attack.attackerCardId}. The provided list must be an exact permutation of the blockers: [${attack.blockerCardIds!.join(", ")}].`,
      );
    }
  }

  const updatedAttacks: AttackDeclaration[] = state.attacks.map((attack) => {
    if (!attack.blockerCardIds || attack.blockerCardIds.length <= 1) {
      return attack;
    }
    return { ...attack, blockerDamageOrder: assignments[attack.attackerCardId]! };
  });

  const stateWithDuel: GameState = {
    ...state,
    phase: "duel_blocker_turn",
    attacks: updatedAttacks,
  };

  return autoAdvanceDuelIfNeeded(stateWithDuel);
}

function applyDamageToRoyal(
  player: PlayerState,
  cardId: CardId,
  damage: number,
): PlayerState {
  const royalIdx = player.court.findIndex((r) => r.cardId === cardId);
  if (royalIdx === -1) return player;
  const royal = player.court[royalIdx]!;
  const updated: RoyalInCourt = { ...royal, damageTaken: royal.damageTaken + damage };
  const court = [...player.court];
  court[royalIdx] = updated;
  return { ...player, court };
}

function isDeadRoyal(royal: RoyalInCourt): boolean {
  return effectiveHealth(royal) <= 0;
}

function removeDeadRoyals(
  player: PlayerState,
  abyss: CardId[],
): { player: PlayerState; abyss: CardId[] } {
  const dead = player.court.filter(isDeadRoyal);
  const toAbyss = dead.flatMap((r) => [r.cardId, ...r.attachedCards]);
  return {
    player: {
      ...player,
      court: player.court.filter((r) => !isDeadRoyal(r)),
    },
    abyss: [...abyss, ...toAbyss],
  };
}

/**
 * Computes direct damage for every unblocked attack (passed: true) across
 * ALL targeted opponents at once — called once, right after every targeted
 * opponent has submitted blocks, before entering the sequential duel queue.
 * Returns the updated player life totals plus the hit outcomes and
 * pre-resolved attacker IDs so executeResolveCombat can skip re-applying them.
 */
function computeImmediateUnblockedHits(state: GameState): {
  players: Record<string, PlayerState>;
  immediateHits: CombatPairOutcome[];
  preResolvedIds: CardId[];
  lifeEvents: Omit<LifeEvent, "seq">[];
} {
  const unblockedAttacks = state.attacks.filter((a) => a.passed && !a.blockerCardIds?.length);

  let players = { ...state.players };
  const immediateHits: CombatPairOutcome[] = [];
  const preResolvedIds: CardId[] = [];
  const lifeEvents: Omit<LifeEvent, "seq">[] = [];

  for (const attack of unblockedAttacks) {
    const attacker = players[attack.attackerPlayerId];
    if (!attacker) continue;
    const attackerRoyal = attacker.court.find((r) => r.cardId === attack.attackerCardId);
    if (!attackerRoyal) continue;

    const atkPower = effectiveAttack(attackerRoyal);
    players[attack.targetPlayerId] = {
      ...players[attack.targetPlayerId]!,
      life: Math.max(0, players[attack.targetPlayerId]!.life - atkPower),
    };

    immediateHits.push({
      attackerCardId: attack.attackerCardId,
      blockerCardIds: [],
      attackerDestroyed: false,
      blockerDestroyed: false,
      directDamage: atkPower,
      targetPlayerId: attack.targetPlayerId,
    });
    preResolvedIds.push(attack.attackerCardId);
    lifeEvents.push({
      kind: "attack_damage",
      targetPlayerId: attack.targetPlayerId,
      amount: atkPower,
      resultingLife: Math.max(0, players[attack.targetPlayerId]!.life),
      actorPlayerId: attack.attackerPlayerId,
      sourceCardId: attack.attackerCardId,
    });
  }

  return { players, immediateHits, preResolvedIds, lifeEvents };
}

/**
 * Builds combat pair outcomes for the given scope of attacks (only the
 * currently-fighting opponent's attacks when a duel is in progress).
 */
function buildCombatSummary(stateBefore: GameState, attacksScope: AttackDeclaration[]): CombatPairOutcome[] {
  return attacksScope.map((attack) => {
    const attacker = stateBefore.players[attack.attackerPlayerId];
    const target = stateBefore.players[attack.targetPlayerId];

    if (!attacker || !target) {
      return {
        attackerCardId: attack.attackerCardId,
        blockerCardIds: attack.blockerCardIds ?? [],
        attackerDestroyed: false,
        blockerDestroyed: false,
        directDamage: 0,
        targetPlayerId: attack.targetPlayerId,
      };
    }

    const attackerRoyal = attacker.court.find((r) => r.cardId === attack.attackerCardId);
    if (!attackerRoyal) {
      return {
        attackerCardId: attack.attackerCardId,
        blockerCardIds: attack.blockerCardIds ?? [],
        attackerDestroyed: true,
        blockerDestroyed: false,
        directDamage: 0,
        targetPlayerId: attack.targetPlayerId,
      };
    }

    const atkPower = effectiveAttack(attackerRoyal);
    const blockerCardIds = attack.blockerCardIds ?? [];

    if (blockerCardIds.length > 0) {
      const damageOrder = attack.blockerDamageOrder?.length === blockerCardIds.length
        ? attack.blockerDamageOrder
        : blockerCardIds;

      let totalBlockerDamage = 0;
      let anyBlockerDestroyed = false;

      for (const blockerId of blockerCardIds) {
        const blockerRoyal = target.court.find((r) => r.cardId === blockerId);
        if (blockerRoyal) {
          totalBlockerDamage += effectiveAttack(blockerRoyal);
        }
      }

      const atkHpAfter = effectiveHealth(attackerRoyal) - totalBlockerDamage;

      let atkRemainingDamage = atkPower;
      for (const blockerId of damageOrder) {
        if (atkRemainingDamage <= 0) break;
        const blockerRoyal = target.court.find((r) => r.cardId === blockerId);
        if (!blockerRoyal) continue;
        const blkHp = effectiveHealth(blockerRoyal);
        const damageToApply = Math.min(atkRemainingDamage, blkHp);
        if (blkHp - damageToApply <= 0) anyBlockerDestroyed = true;
        atkRemainingDamage = Math.max(0, atkRemainingDamage - blkHp);
      }

      return {
        attackerCardId: attack.attackerCardId,
        blockerCardIds,
        attackerDestroyed: atkHpAfter <= 0,
        blockerDestroyed: anyBlockerDestroyed,
        directDamage: 0,
        targetPlayerId: attack.targetPlayerId,
      };
    }

    return {
      attackerCardId: attack.attackerCardId,
      blockerCardIds: [],
      attackerDestroyed: false,
      blockerDestroyed: false,
      directDamage: atkPower,
      targetPlayerId: attack.targetPlayerId,
    };
  });
}

function currentDuelAttacks(state: GameState): AttackDeclaration[] {
  const ctx = state.duelContext;
  if (!ctx) return state.attacks;
  return state.attacks.filter((a) => a.targetPlayerId === ctx.defenderPlayerId);
}

function executeResolveCombat(state: GameState): Result<GameState> {
  const ctx = state.duelContext;
  const scopeAttacks = currentDuelAttacks(state);
  const pairs = buildCombatSummary(state, scopeAttacks);

  let players = { ...state.players };
  let abyss = [...state.abyss];
  const newLifeEvents: Omit<LifeEvent, "seq">[] = [];

  const resolvedPairs = ctx?.resolvedPairAttackerIds ?? [];
  const preResolvedUnblocked = ctx?.preResolvedUnblockedAttackerIds ?? [];

  for (const attack of scopeAttacks) {
    if (resolvedPairs.includes(attack.attackerCardId)) continue;
    if (preResolvedUnblocked.includes(attack.attackerCardId)) continue;

    const attacker = players[attack.attackerPlayerId];
    const target = players[attack.targetPlayerId];
    if (!attacker || !target) continue;

    const attackerRoyal = attacker.court.find((r) => r.cardId === attack.attackerCardId);
    if (!attackerRoyal) continue;

    const atkPower = effectiveAttack(attackerRoyal);
    const blockerCardIds = attack.blockerCardIds ?? [];

    if (blockerCardIds.length > 0 && !attack.passed) {
      const damageOrder = attack.blockerDamageOrder?.length === blockerCardIds.length
        ? attack.blockerDamageOrder
        : blockerCardIds;

      let totalBlockerDamage = 0;
      for (const blockerId of blockerCardIds) {
        const blockerRoyal = players[attack.targetPlayerId]!.court.find((r) => r.cardId === blockerId);
        if (blockerRoyal) {
          totalBlockerDamage += effectiveAttack(blockerRoyal);
        }
      }

      players[attack.attackerPlayerId] = applyDamageToRoyal(
        players[attack.attackerPlayerId]!,
        attack.attackerCardId,
        totalBlockerDamage,
      );

      let atkRemainingDamage = atkPower;
      for (const blockerId of damageOrder) {
        if (atkRemainingDamage <= 0) break;
        const currentTarget = players[attack.targetPlayerId]!;
        const blockerRoyal = currentTarget.court.find((r) => r.cardId === blockerId);
        if (!blockerRoyal) continue;
        const blkCurrentHp = effectiveHealth(blockerRoyal);
        const damageToApply = Math.min(atkRemainingDamage, blkCurrentHp);
        players[attack.targetPlayerId] = applyDamageToRoyal(
          players[attack.targetPlayerId]!,
          blockerId,
          damageToApply,
        );
        atkRemainingDamage = Math.max(0, atkRemainingDamage - blkCurrentHp);
      }
    } else if (!attack.blockerCardIds?.length) {
      players[attack.targetPlayerId] = {
        ...players[attack.targetPlayerId]!,
        life: Math.max(0, players[attack.targetPlayerId]!.life - atkPower),
      };
      newLifeEvents.push({
        kind: "attack_damage",
        targetPlayerId: attack.targetPlayerId,
        amount: atkPower,
        resultingLife: Math.max(0, players[attack.targetPlayerId]!.life),
        actorPlayerId: attack.attackerPlayerId,
        sourceCardId: attack.attackerCardId,
      });
    }
  }

  let stateWithEvents: GameState = state;
  for (const ev of newLifeEvents) {
    stateWithEvents = pushLifeEvent(stateWithEvents, ev);
  }

  for (const playerId of activePlayers(state)) {
    const result = removeDeadRoyals(players[playerId]!, abyss);
    players[playerId] = result.player;
    abyss = result.abyss;
  }

  const accumulatedPairs = [...(state.combatPairsAccumulator ?? []), ...pairs];
  const accumulatedAutoPassed = Array.from(
    new Set([...(state.combatAutoPassedAccum ?? []), ...(ctx?.autoPassedPlayerIds ?? [])]),
  );
  const anyDuelShown = !!state.combatDuelShownAccum || !!ctx?.duelPhaseShown;

  const queue = state.duelQueue ?? [];

  if (queue.length > 0 && ctx) {
    const [nextDefenderId, ...restQueue] = queue;
    return enterNextDuel(
      {
        ...stateWithEvents,
        players,
        abyss,
        combatPairsAccumulator: accumulatedPairs,
        combatAutoPassedAccum: accumulatedAutoPassed,
        combatDuelShownAccum: anyDuelShown,
      },
      ctx.attackerPlayerId,
      nextDefenderId!,
      restQueue,
    );
  }

  const finalSummary: CombatSummary = {
    pairs: accumulatedPairs,
    autoPassedPlayerIds: accumulatedAutoPassed.length ? accumulatedAutoPassed : undefined,
    immediateHits: ctx?.immediateHits?.length ? ctx.immediateHits : undefined,
    // Blocked pairs existed (we're in executeResolveCombat via a duel context)
    // yet no duel phase ever reached clients — the whole fight auto-resolved.
    autoResolved: ctx && !anyDuelShown ? true : undefined,
  };

  return ok({
    ...stateWithEvents,
    phase: "main",
    players,
    abyss,
    attacks: [],
    duelContext: undefined,
    duelQueue: undefined,
    combatPairsAccumulator: undefined,
    combatAutoPassedAccum: undefined,
    combatDuelShownAccum: undefined,
    lastCombatSummary: finalSummary,
  });
}

/**
 * Returns true if the given Royal is part of a duel pair that has already
 * been resolved (a Club debuff landed on it). Safe to call outside duel phases.
 */
export function isRoyalInResolvedDuelPair(state: GameState, royalId: CardId): boolean {
  const ctx = state.duelContext;
  if (!ctx) return false;
  const resolved = ctx.resolvedPairAttackerIds ?? [];
  if (resolved.length === 0) return false;
  const pairId = findPairAttackerIdForRoyal(currentDuelAttacks(state), royalId);
  return pairId !== undefined && resolved.includes(pairId);
}

/**
 * Returns true if the given Royal is part of a blocked pair that is still
 * active (not yet resolved) IN THE CURRENTLY-FIGHTING opponent's duel. Use
 * this to gate duel card plays to active pairs — queued (not-yet-active)
 * opponents' pairs are intentionally excluded.
 */
export function isRoyalInActiveDuelPair(state: GameState, royalId: CardId): boolean {
  const ctx = state.duelContext;
  if (!ctx) return false;
  const resolved = ctx.resolvedPairAttackerIds ?? [];
  for (const attack of currentDuelAttacks(state)) {
    if (!attack.blockerCardIds?.length) continue;
    if (resolved.includes(attack.attackerCardId)) continue;
    if (attack.attackerCardId === royalId || attack.blockerCardIds.includes(royalId)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns the attackerCardId of the duel pair that contains the given Royal
 * (as either attacker or blocker). Only considers blocked pairs (duel pairs).
 * Returns undefined if the Royal is not part of any blocked pair.
 * Callers should pass an already-scoped attacks list (e.g. currentDuelAttacks)
 * when a duel is in progress, so queued opponents' pairs aren't matched.
 */
export function findPairAttackerIdForRoyal(
  attacks: AttackDeclaration[],
  royalId: CardId,
): CardId | undefined {
  for (const attack of attacks) {
    if (!attack.blockerCardIds?.length) continue;
    if (attack.attackerCardId === royalId) return attack.attackerCardId;
    if (attack.blockerCardIds.includes(royalId)) return attack.attackerCardId;
  }
  return undefined;
}

/**
 * Marks the duel pair containing `royalId` as resolved (a Club debuff landed).
 * If all of the CURRENT opponent's blocked pairs are now resolved, executes
 * combat resolution (which advances to the next opponent in the queue, if any).
 * If the Royal is not part of any blocked pair, or if already resolved, returns the state unchanged.
 */
export function markDuelPairResolved(state: GameState, royalId: CardId): Result<GameState> {
  const ctx = state.duelContext;
  if (!ctx) return ok(state);

  const scopeAttacks = currentDuelAttacks(state);
  const pairAttackerId = findPairAttackerIdForRoyal(scopeAttacks, royalId);
  const resolved = ctx.resolvedPairAttackerIds ?? [];

  const updatedResolved =
    pairAttackerId && !resolved.includes(pairAttackerId)
      ? [...resolved, pairAttackerId]
      : resolved;

  const updatedCtx: DuelContext = {
    ...ctx,
    resolvedPairAttackerIds: updatedResolved,
  };

  const newState: GameState = { ...state, duelContext: updatedCtx };

  const blockedPairs = scopeAttacks.filter((a) => a.blockerCardIds?.length);
  const allResolved =
    blockedPairs.length > 0 &&
    blockedPairs.every((a) => updatedResolved.includes(a.attackerCardId));

  if (allResolved) {
    return executeResolveCombat(newState);
  }

  return ok(newState);
}

export function resolveCombat(state: GameState, callerPlayerId: string): Result<GameState> {
  const isDuelPhase = state.phase === "duel_attacker_turn" || state.phase === "duel_blocker_turn";
  if (state.phase !== "declare_blocks" && !isDuelPhase) {
    return err(`Cannot resolve combat during phase "${state.phase}". Must be in "declare_blocks" or a duel phase.`);
  }
  if (state.activePlayerId !== callerPlayerId) {
    return err("Only the active player can resolve combat");
  }

  const scopeAttacks = currentDuelAttacks(state);
  const undecided = scopeAttacks.filter((a) => !a.blockerCardIds?.length && !a.passed);
  if (undecided.length > 0) {
    return err("All defenders must block or pass before combat can be resolved");
  }

  return executeResolveCombat(state);
}

export function duelPass(
  state: GameState,
  playerId: string,
): Result<GameState> {
  const isDuelPhase = state.phase === "duel_attacker_turn" || state.phase === "duel_blocker_turn";
  if (!isDuelPhase) {
    return err(`Cannot pass during phase "${state.phase}". Must be in a duel phase.`);
  }

  const ctx = state.duelContext;
  if (!ctx) return err("No duel context found");

  const isAttacker = playerId === ctx.attackerPlayerId;
  const isDefender = playerId === ctx.defenderPlayerId;

  if (state.phase === "duel_attacker_turn" && !isAttacker) {
    return err("It is not your turn to act in the duel");
  }
  if (state.phase === "duel_blocker_turn" && !isDefender) {
    return err("It is not your turn to act in the duel");
  }

  const newCtx: DuelContext = {
    ...ctx,
    duelAttackerPassed: isAttacker ? true : ctx.duelAttackerPassed,
    duelBlockerPassed: isDefender ? true : ctx.duelBlockerPassed,
  };

  if (newCtx.duelAttackerPassed && newCtx.duelBlockerPassed) {
    return executeResolveCombat({ ...state, duelContext: newCtx });
  }

  const nextPhase: "duel_blocker_turn" | "duel_attacker_turn" = state.phase === "duel_attacker_turn" ? "duel_blocker_turn" : "duel_attacker_turn";
  const nextState: GameState = { ...state, phase: nextPhase, duelContext: newCtx };

  return autoAdvanceDuelIfNeeded(nextState);
}

export function advanceDuelTurn(state: GameState, actingPlayerId: string): Result<GameState> {
  const isDuelPhase = state.phase === "duel_attacker_turn" || state.phase === "duel_blocker_turn";
  if (!isDuelPhase || !state.duelContext) return ok(state);

  const ctx = state.duelContext;
  const isAttacker = actingPlayerId === ctx.attackerPlayerId;

  const newCtx: DuelContext = {
    ...ctx,
    duelAttackerPassed: isAttacker ? false : ctx.duelAttackerPassed,
    duelBlockerPassed: !isAttacker ? false : ctx.duelBlockerPassed,
  };

  const nextPhase = state.phase === "duel_attacker_turn" ? "duel_blocker_turn" : "duel_attacker_turn";
  const nextState: GameState = { ...state, phase: nextPhase, duelContext: newCtx };

  return autoAdvanceDuelIfNeeded(nextState);
}

export function autoAdvanceDuelIfNeeded(state: GameState): Result<GameState> {
  const isDuelPhase = state.phase === "duel_attacker_turn" || state.phase === "duel_blocker_turn";
  if (!isDuelPhase || !state.duelContext) return ok(state);

  const ctx = state.duelContext;
  const isAttackerTurn = state.phase === "duel_attacker_turn";
  const currentPlayerId = isAttackerTurn ? ctx.attackerPlayerId : ctx.defenderPlayerId;
  const currentPlayer = state.players[currentPlayerId];
  if (!currentPlayer) return ok(state);

  if (hasDuelPlayableCard(currentPlayer, state)) {
    // This duel-phase state persists and reaches clients — the duel is visible.
    if (ctx.duelPhaseShown) return ok(state);
    return ok({ ...state, duelContext: { ...ctx, duelPhaseShown: true } });
  }

  const existingAutoPassedIds = ctx.autoPassedPlayerIds ?? [];
  const updatedAutoPassedIds = existingAutoPassedIds.includes(currentPlayerId)
    ? existingAutoPassedIds
    : [...existingAutoPassedIds, currentPlayerId];

  const newCtx: DuelContext = {
    ...ctx,
    duelAttackerPassed: currentPlayerId === ctx.attackerPlayerId ? true : ctx.duelAttackerPassed,
    duelBlockerPassed: currentPlayerId === ctx.defenderPlayerId ? true : ctx.duelBlockerPassed,
    autoPassedPlayerIds: updatedAutoPassedIds,
  };

  if (newCtx.duelAttackerPassed && newCtx.duelBlockerPassed) {
    return executeResolveCombat({ ...state, duelContext: newCtx });
  }

  const nextPhase: "duel_blocker_turn" | "duel_attacker_turn" = isAttackerTurn ? "duel_blocker_turn" : "duel_attacker_turn";
  const nextPlayerId = nextPhase === "duel_attacker_turn" ? ctx.attackerPlayerId : ctx.defenderPlayerId;
  const nextPlayer = state.players[nextPlayerId];
  const nextState: GameState = {
    ...state,
    phase: nextPhase,
    // This duel-phase state persists and reaches clients — the duel is visible.
    duelContext: { ...newCtx, duelPhaseShown: true },
  };
  if (!nextPlayer || !hasDuelPlayableCard(nextPlayer, nextState)) {
    const nextAutoPassedIds = updatedAutoPassedIds.includes(nextPlayerId)
      ? updatedAutoPassedIds
      : [...updatedAutoPassedIds, nextPlayerId];
    const bothPassedCtx: DuelContext = {
      ...newCtx,
      duelAttackerPassed: true,
      duelBlockerPassed: true,
      autoPassedPlayerIds: nextAutoPassedIds,
    };
    return executeResolveCombat({ ...state, duelContext: bothPassedCtx });
  }

  return ok(nextState);
}
