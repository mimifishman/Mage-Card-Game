import { effectiveAttack, effectiveHealth, getCard } from "./cards";
import type {
  AttackDeclaration,
  CardId,
  CombatPairOutcome,
  CombatSummary,
  DuelContext,
  GameState,
  PlayerState,
  Result,
  RoyalInCourt,
} from "./types";
import { err, ok } from "./types";
import { availableVault } from "./vault";


function activePlayers(state: GameState): string[] {
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
  targetPlayerId: string,
  royalCardIds: CardId[],
): Result<GameState> {
  if (state.activePlayerId !== attackerPlayerId) {
    return err("It is not your turn");
  }
  if (state.phase !== "main") {
    return err(`Cannot declare attack during phase "${state.phase}". Must be in "main".`);
  }
  if (attackerPlayerId === targetPlayerId) {
    return err("Cannot attack yourself");
  }
  if (state.hasAttackedThisTurn) {
    return err("You have already attacked this turn");
  }
  if (royalCardIds.length === 0) {
    return err("Must select at least one Royal to attack with");
  }
  if (new Set(royalCardIds).size !== royalCardIds.length) {
    return err("Duplicate Royal IDs in attack selection — each Royal can only attack once");
  }

  const attacker = state.players[attackerPlayerId];
  if (!attacker) return err(`Player ${attackerPlayerId} not found`);

  const target = state.players[targetPlayerId];
  if (!target) return err(`Player ${targetPlayerId} not found`);
  if (target.isEliminated) return err(`Player ${targetPlayerId} is eliminated`);

  for (const royalId of royalCardIds) {
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

  const selectedIds = new Set(royalCardIds);
  const updatedCourt = attacker.court.map((r) =>
    selectedIds.has(r.cardId)
      ? { ...r, hasAttackedThisTurn: true }
      : r,
  );
  const updatedAttacker: PlayerState = { ...attacker, court: updatedCourt };

  const newAttacks: AttackDeclaration[] = royalCardIds.map((royalId) => ({
    attackerPlayerId,
    attackerCardId: royalId,
    targetPlayerId,
  }));

  return ok({
    ...state,
    phase: "declare_blocks",
    hasAttackedThisTurn: true,
    players: { ...state.players, [attackerPlayerId]: updatedAttacker },
    attacks: newAttacks,
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

  const attackerPlayerId = incomingAttacks[0]!.attackerPlayerId;

  const hasMultiBlocker = updatedAttacks.some(
    (a) => a.blockerCardIds && a.blockerCardIds.length > 1,
  );

  const duelContext: DuelContext = {
    attackerPlayerId,
    defenderPlayerId,
    duelAttackerPassed: false,
    duelBlockerPassed: false,
    attackerDiamondUsed: false,
    defenderDiamondUsed: false,
  };

  if (hasMultiBlocker) {
    return ok({
      ...state,
      phase: "assign_damage_order",
      attacks: updatedAttacks,
      duelContext,
      lastCombatSummary: undefined,
    });
  }

  const stateWithDuel: GameState = {
    ...state,
    phase: "duel_blocker_turn",
    attacks: updatedAttacks,
    duelContext,
    lastCombatSummary: undefined,
  };

  return autoAdvanceDuelIfNeeded(stateWithDuel);
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
    (a) => a.blockerCardIds && a.blockerCardIds.length > 1,
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

function buildCombatSummary(stateBefore: GameState): CombatSummary {
  const pairs: CombatPairOutcome[] = stateBefore.attacks.map((attack) => {
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

  return { pairs };
}

function executeResolveCombat(state: GameState): Result<GameState> {
  const summary = buildCombatSummary(state);

  let players = { ...state.players };
  let abyss = [...state.abyss];

  for (const attack of state.attacks) {
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
        life: players[attack.targetPlayerId]!.life - atkPower,
      };
    }
  }

  for (const playerId of activePlayers(state)) {
    const result = removeDeadRoyals(players[playerId]!, abyss);
    players[playerId] = result.player;
    abyss = result.abyss;
  }

  return ok({
    ...state,
    phase: "main",
    players,
    abyss,
    attacks: [],
    duelContext: undefined,
    lastCombatSummary: summary,
  });
}

export function resolveCombat(state: GameState, callerPlayerId: string): Result<GameState> {
  const isDuelPhase = state.phase === "duel_attacker_turn" || state.phase === "duel_blocker_turn";
  if (state.phase !== "declare_blocks" && !isDuelPhase) {
    return err(`Cannot resolve combat during phase "${state.phase}". Must be in "declare_blocks" or a duel phase.`);
  }
  if (state.activePlayerId !== callerPlayerId) {
    return err("Only the active player can resolve combat");
  }

  const undecided = state.attacks.filter((a) => !a.blockerCardIds?.length && !a.passed);
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

  if (hasDuelPlayableCard(currentPlayer, state)) return ok(state);

  const newCtx: DuelContext = {
    ...ctx,
    duelAttackerPassed: currentPlayerId === ctx.attackerPlayerId ? true : ctx.duelAttackerPassed,
    duelBlockerPassed: currentPlayerId === ctx.defenderPlayerId ? true : ctx.duelBlockerPassed,
  };

  if (newCtx.duelAttackerPassed && newCtx.duelBlockerPassed) {
    return executeResolveCombat({ ...state, duelContext: newCtx });
  }

  const nextPhase: "duel_blocker_turn" | "duel_attacker_turn" = isAttackerTurn ? "duel_blocker_turn" : "duel_attacker_turn";
  const nextPlayerId = nextPhase === "duel_attacker_turn" ? ctx.attackerPlayerId : ctx.defenderPlayerId;
  const nextPlayer = state.players[nextPlayerId];
  const nextState: GameState = { ...state, phase: nextPhase, duelContext: newCtx };
  if (!nextPlayer || !hasDuelPlayableCard(nextPlayer, nextState)) {
    const bothPassedCtx: DuelContext = { ...newCtx, duelAttackerPassed: true, duelBlockerPassed: true };
    return executeResolveCombat({ ...state, duelContext: bothPassedCtx });
  }

  return ok(nextState);
}
