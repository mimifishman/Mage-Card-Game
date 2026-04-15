import { effectiveAttack, effectiveHealth, getCard, royalBaseHealth } from "./cards";
import type { AttackDeclaration, CardId, GameState, PlayerState, Rank, Result, RoyalInCourt } from "./types";
import { err, ok } from "./types";

export function beginDeclareBlocks(state: GameState): Result<GameState> {
  if (state.phase !== "declare_attacks") {
    return err(
      `Cannot begin block declarations from phase "${state.phase}". Must be "declare_attacks".`,
    );
  }
  if (state.attacks.length === 0) {
    return err("No attacks declared; cannot begin block declarations");
  }
  return ok({ ...state, phase: "declare_blocks" });
}

function activePlayers(state: GameState): string[] {
  return state.turnOrder.filter((id) => !state.players[id]?.isEliminated);
}

export function declareAttack(
  state: GameState,
  attackerPlayerId: string,
  attackerCardId: CardId,
  targetPlayerId: string,
): Result<GameState> {
  if (state.activePlayerId !== attackerPlayerId) {
    return err("It is not your turn");
  }
  if (state.phase !== "main" && state.phase !== "declare_attacks") {
    return err(`Cannot declare attacks during phase "${state.phase}"`);
  }
  if (attackerPlayerId === targetPlayerId) {
    return err("Cannot attack yourself");
  }

  const attacker = state.players[attackerPlayerId];
  if (!attacker) return err(`Player ${attackerPlayerId} not found`);

  const target = state.players[targetPlayerId];
  if (!target) return err(`Player ${targetPlayerId} not found`);
  if (target.isEliminated) return err(`Player ${targetPlayerId} is eliminated`);

  const royal = attacker.court.find((r) => r.cardId === attackerCardId);
  if (!royal) {
    return err(`Royal ${attackerCardId} is not in your Court`);
  }
  if (royal.hasteLocked) {
    return err(`Royal ${attackerCardId} is haste-locked and cannot attack on the turn it was played`);
  }
  if (royal.hasAttackedThisTurn) {
    return err(`Royal ${attackerCardId} has already attacked this turn`);
  }

  const alreadyAttacking = state.attacks.some(
    (a) => a.attackerCardId === attackerCardId,
  );
  if (alreadyAttacking) {
    return err(`Royal ${attackerCardId} is already declared as an attacker`);
  }

  const updatedRoyal: RoyalInCourt = { ...royal, hasAttackedThisTurn: true };
  const updatedCourt = attacker.court.map((r) =>
    r.cardId === attackerCardId ? updatedRoyal : r,
  );
  const updatedAttacker: PlayerState = { ...attacker, court: updatedCourt };

  const newAttack: AttackDeclaration = {
    attackerPlayerId,
    attackerCardId,
    targetPlayerId,
  };

  return ok({
    ...state,
    phase: "declare_attacks",
    players: { ...state.players, [attackerPlayerId]: updatedAttacker },
    attacks: [...state.attacks, newAttack],
  });
}

export function declareBlock(
  state: GameState,
  defenderPlayerId: string,
  blockerCardId: CardId,
  attackerCardId: CardId,
): Result<GameState> {
  if (state.phase !== "declare_blocks") {
    return err(`Can only declare blocks during "declare_blocks" phase`);
  }

  const attackIdx = state.attacks.findIndex(
    (a) => a.attackerCardId === attackerCardId && a.targetPlayerId === defenderPlayerId,
  );
  if (attackIdx === -1) {
    return err(`No attack targeting you with attacker ${attackerCardId}`);
  }

  const attack = state.attacks[attackIdx]!;
  if (attack.passed) {
    return err(`Attack by ${attackerCardId} was already passed; cannot declare a block`);
  }
  if (attack.blockerCardId) {
    return err(`Attack by ${attackerCardId} already has a blocker`);
  }

  const defender = state.players[defenderPlayerId];
  if (!defender) return err(`Player ${defenderPlayerId} not found`);

  const blockerExists = defender.court.some((r) => r.cardId === blockerCardId);
  if (!blockerExists) {
    return err(`Blocker ${blockerCardId} is not in your Court`);
  }

  const alreadyBlocking = state.attacks.some(
    (a) => a.blockerCardId === blockerCardId,
  );
  if (alreadyBlocking) {
    return err(`${blockerCardId} is already blocking another attack`);
  }

  const updatedAttacks = [...state.attacks];
  updatedAttacks[attackIdx] = { ...attack, blockerCardId };

  return ok({ ...state, attacks: updatedAttacks });
}

export function passBlock(
  state: GameState,
  defenderPlayerId: string,
  attackerCardId: CardId,
): Result<GameState> {
  if (state.phase !== "declare_blocks") {
    return err(`Can only pass blocks during "declare_blocks" phase`);
  }

  const attackIdx = state.attacks.findIndex(
    (a) => a.attackerCardId === attackerCardId && a.targetPlayerId === defenderPlayerId,
  );
  if (attackIdx === -1) {
    return err(`No attack targeting you with attacker ${attackerCardId}`);
  }

  const attack = state.attacks[attackIdx]!;
  if (attack.blockerCardId) {
    return err(`Attack by ${attackerCardId} is already blocked`);
  }
  if (attack.passed) {
    return err(`Attack by ${attackerCardId} already passed`);
  }

  const updatedAttacks = [...state.attacks];
  updatedAttacks[attackIdx] = { ...attack, passed: true };

  return ok({ ...state, attacks: updatedAttacks });
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
  const lifeLoss = dead.reduce((sum, r) => {
    const card = getCard(r.cardId);
    return sum + royalBaseHealth(card.rank as Rank) + r.buffHealth;
  }, 0);
  return {
    player: {
      ...player,
      court: player.court.filter((r) => !isDeadRoyal(r)),
      life: player.life - lifeLoss,
    },
    abyss: [...abyss, ...toAbyss],
  };
}

export function resolveCombat(state: GameState, callerPlayerId: string): Result<GameState> {
  if (state.phase !== "declare_blocks") {
    return err(`Cannot resolve combat during phase "${state.phase}". Must be in "declare_blocks".`);
  }
  if (state.activePlayerId !== callerPlayerId) {
    return err("Only the active player can resolve combat");
  }

  const undecided = state.attacks.filter((a) => !a.blockerCardId && !a.passed);
  if (undecided.length > 0) {
    return err("All defenders must block or pass before combat can be resolved");
  }

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
    phase: "end_turn",
    players,
    abyss,
    attacks: [],
  });
}
