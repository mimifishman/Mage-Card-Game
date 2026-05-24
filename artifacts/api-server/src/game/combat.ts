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


function activePlayers(state: GameState): string[] {
  return state.turnOrder.filter((id) => !state.players[id]?.isEliminated);
}

function hasDuelPlayableCard(player: PlayerState): boolean {
  return player.hand.some((cardId) => !getCard(cardId).isRoyal);
}

export function declareAttack(
  state: GameState,
  attackerPlayerId: string,
  targetPlayerId: string,
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

  const attacker = state.players[attackerPlayerId];
  if (!attacker) return err(`Player ${attackerPlayerId} not found`);

  const target = state.players[targetPlayerId];
  if (!target) return err(`Player ${targetPlayerId} not found`);
  if (target.isEliminated) return err(`Player ${targetPlayerId} is eliminated`);

  const eligibleRoyals = attacker.court.filter((r) => !r.hasteLocked && !r.hasAttackedThisTurn);
  if (eligibleRoyals.length === 0) {
    return err("No eligible Royals to attack with (all are haste-locked or have already attacked)");
  }

  const updatedCourt = attacker.court.map((r) =>
    !r.hasteLocked && !r.hasAttackedThisTurn
      ? { ...r, hasAttackedThisTurn: true }
      : r,
  );
  const updatedAttacker: PlayerState = { ...attacker, court: updatedCourt };

  const newAttacks: AttackDeclaration[] = eligibleRoyals.map((r) => ({
    attackerPlayerId,
    attackerCardId: r.cardId,
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
  blocks: Record<CardId, CardId | "pass">,
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
      const blockerExists = defender.court.some((r) => r.cardId === assignment);
      if (!blockerExists) {
        return err(`Blocker ${assignment} is not in your Court`);
      }
      if (blockerUsed.has(assignment)) {
        return err(`Blocker ${assignment} is already used for another attack`);
      }
      blockerUsed.add(assignment);
      updatedAttacks[attackIdx] = { ...updatedAttacks[attackIdx]!, blockerCardId: assignment };
    }
  }

  const attackerPlayerId = incomingAttacks[0]!.attackerPlayerId;

  const duelContext: DuelContext = {
    attackerPlayerId,
    defenderPlayerId,
    duelAttackerPassed: false,
    duelBlockerPassed: false,
    attackerDiamondUsed: false,
    defenderDiamondUsed: false,
  };

  const stateWithDuel: GameState = {
    ...state,
    phase: "duel_attacker_turn",
    attacks: updatedAttacks,
    duelContext,
    lastCombatSummary: undefined,
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
        blockerCardId: attack.blockerCardId ?? null,
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
        blockerCardId: attack.blockerCardId ?? null,
        attackerDestroyed: true,
        blockerDestroyed: false,
        directDamage: 0,
        targetPlayerId: attack.targetPlayerId,
      };
    }

    const atkPower = effectiveAttack(attackerRoyal);

    if (attack.blockerCardId) {
      const blockerRoyal = target.court.find((r) => r.cardId === attack.blockerCardId);
      if (!blockerRoyal) {
        return {
          attackerCardId: attack.attackerCardId,
          blockerCardId: attack.blockerCardId,
          attackerDestroyed: false,
          blockerDestroyed: true,
          directDamage: 0,
          targetPlayerId: attack.targetPlayerId,
        };
      }
      const blkPower = effectiveAttack(blockerRoyal);
      const atkHpAfter = effectiveHealth(attackerRoyal) - blkPower;
      const blkHpAfter = effectiveHealth(blockerRoyal) - atkPower;
      return {
        attackerCardId: attack.attackerCardId,
        blockerCardId: attack.blockerCardId,
        attackerDestroyed: atkHpAfter <= 0,
        blockerDestroyed: blkHpAfter <= 0,
        directDamage: 0,
        targetPlayerId: attack.targetPlayerId,
      };
    }

    return {
      attackerCardId: attack.attackerCardId,
      blockerCardId: null,
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

    if (attack.blockerCardId) {
      const blockerRoyal = target.court.find((r) => r.cardId === attack.blockerCardId);
      if (!blockerRoyal) continue;
      const blkPower = effectiveAttack(blockerRoyal);

      players[attack.attackerPlayerId] = applyDamageToRoyal(
        players[attack.attackerPlayerId]!,
        attack.attackerCardId,
        blkPower,
      );
      players[attack.targetPlayerId] = applyDamageToRoyal(
        players[attack.targetPlayerId]!,
        attack.blockerCardId,
        atkPower,
      );
    } else {
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

  const undecided = state.attacks.filter((a) => !a.blockerCardId && !a.passed);
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

function autoAdvanceDuelIfNeeded(state: GameState): Result<GameState> {
  const isDuelPhase = state.phase === "duel_attacker_turn" || state.phase === "duel_blocker_turn";
  if (!isDuelPhase || !state.duelContext) return ok(state);

  const ctx = state.duelContext;
  const isAttackerTurn = state.phase === "duel_attacker_turn";
  const currentPlayerId = isAttackerTurn ? ctx.attackerPlayerId : ctx.defenderPlayerId;
  const currentPlayer = state.players[currentPlayerId];
  if (!currentPlayer) return ok(state);

  if (hasDuelPlayableCard(currentPlayer)) return ok(state);

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
  if (!nextPlayer || !hasDuelPlayableCard(nextPlayer)) {
    const bothPassedCtx: DuelContext = { ...newCtx, duelAttackerPassed: true, duelBlockerPassed: true };
    return executeResolveCombat({ ...state, duelContext: bothPassedCtx });
  }

  return ok({ ...state, phase: nextPhase, duelContext: newCtx });
}
