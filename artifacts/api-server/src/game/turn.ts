import type { GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";
import { drawCard } from "./draw";
import { resetVaultForTurn, calculateVaultFromMine } from "./vault";
import { pushLifeEvent } from "./lifeEvents";

const MAX_HAND_SIZE = 7;

export function eliminatePlayerIfNeeded(
  state: GameState,
  playerId: string,
): GameState {
  const player = state.players[playerId];
  if (!player || player.isEliminated) return state;
  if (player.life > 0) return state;

  const eliminated: PlayerState = {
    ...player,
    isEliminated: true,
    court: [],
  };

  const allCards = [
    ...player.court.flatMap((r) => [r.cardId, ...r.attachedCards]),
  ];

  const prevSeq = Math.max(0, ...(state.lastEliminations ?? []).map((e) => e.seq));

  return pushLifeEvent(
    {
      ...state,
      players: { ...state.players, [playerId]: eliminated },
      abyss: [...state.abyss, ...allCards],
      lastEliminations: [
        ...(state.lastEliminations ?? []),
        { playerId, sweptCardIds: allCards, seq: prevSeq + 1 },
      ],
    },
    {
      kind: "elimination",
      targetPlayerId: playerId,
      amount: 0,
      resultingLife: Math.max(0, player.life),
    },
  );
}

export function advanceTurn(state: GameState): Result<GameState> {
  const active = state.turnOrder.filter(
    (id) => !state.players[id]?.isEliminated,
  );

  if (active.length <= 1) {
    return ok({ ...state, phase: "end_turn" });
  }

  const currentIdx = active.indexOf(state.activePlayerId);
  const nextIdx = (currentIdx + 1) % active.length;
  const nextPlayerId = active[nextIdx]!;

  // Freeze the outgoing player's Vault at the current Mine total so later Mine
  // additions by others don't raise it before their next turn.
  const outgoingId = state.activePlayerId;
  const outgoing = state.players[outgoingId]!;
  const frozenOutgoing: PlayerState = {
    ...outgoing,
    vault: { ...outgoing.vault, frozenMineTotal: calculateVaultFromMine(state.mine) },
  };

  const nextPlayerBase = resetVaultForTurn(state.players[nextPlayerId]!);
  const isFirstTurn = !nextPlayerBase.hasHadFirstTurn;

  const untappedCourt = nextPlayerBase.court.map((r) => ({
    ...r,
    hasAttackedThisTurn: false,
  }));

  const nextPlayer: PlayerState = {
    ...nextPlayerBase,
    court: untappedCourt,
    hasPlayedDiamondThisTurn: false,
    hasHadFirstTurn: true,
  };

  const preparedState: GameState = {
    ...state,
    phase: "main",
    turnNumber: state.turnNumber + 1,
    activePlayerId: nextPlayerId,
    players: {
      ...state.players,
      [outgoingId]: frozenOutgoing,
      [nextPlayerId]: nextPlayer,
    },
  };

  if (isFirstTurn) {
    return ok(preparedState);
  }
  return drawCard(preparedState, nextPlayerId);
}

function healAllRoyals(state: GameState): GameState {
  const updatedPlayers: Record<string, PlayerState> = { ...state.players };

  for (const [playerId, player] of Object.entries(state.players)) {
    if (player.isEliminated) continue;

    const healedCourt = player.court.map((r) => ({
      ...r,
      damageTaken: 0,
      hasteLocked: false,
    }));

    updatedPlayers[playerId] = { ...player, court: healedCourt };
  }

  return { ...state, players: updatedPlayers };
}

export function endTurnCleanupAndAdvance(state: GameState): Result<GameState> {
  let current = state;

  for (const playerId of current.turnOrder) {
    current = eliminatePlayerIfNeeded(current, playerId);
  }

  const active = current.turnOrder.filter(
    (id) => !current.players[id]?.isEliminated,
  );

  if (active.length <= 1) {
    const winnerId = active[0] ?? null;
    return ok({
      ...current,
      phase: "end_turn",
      activePlayerId: winnerId ?? current.activePlayerId,
    });
  }

  current = {
    ...healAllRoyals(current),
    attacks: [],
    hasAttackedThisTurn: false,
    duelContext: undefined,
  };

  return advanceTurn(current);
}

export function endTurn(state: GameState): Result<GameState> {
  const isDuelPhase = state.phase === "duel_attacker_turn" || state.phase === "duel_blocker_turn";
  if (isDuelPhase) {
    return err(`Cannot end turn during a duel. The duel must complete first.`);
  }

  if (
    state.phase !== "end_turn" &&
    state.phase !== "resolve_combat" &&
    state.phase !== "declare_attacks" &&
    state.phase !== "declare_blocks" &&
    state.phase !== "main"
  ) {
    return err(`Cannot end turn during phase "${state.phase}"`);
  }

  const activePlayer = state.players[state.activePlayerId];
  if (activePlayer && activePlayer.hand.length > MAX_HAND_SIZE) {
    return ok({ ...state, phase: "discard" });
  }

  return endTurnCleanupAndAdvance(state);
}

export function isGameOver(state: GameState): boolean {
  const active = state.turnOrder.filter(
    (id) => !state.players[id]?.isEliminated,
  );
  return active.length <= 1;
}

/** True when this phase's priority holder is derived from something that a
 * mid-turn elimination may have just removed (an attack, a duel, a pending
 * Club) rather than from activePlayerId. Mirrors getTurnHolderId in
 * dispatcher.ts, which cannot be imported here without a cycle. */
function phaseHasHolder(state: GameState): boolean {
  switch (state.phase) {
    case "declare_blocks":
      return state.attacks.length > 0;
    case "duel_attacker_turn":
    case "duel_blocker_turn":
    case "assign_damage_order":
      return state.duelContext !== undefined;
    case "respond_to_club":
      return state.pendingClubDebuff !== undefined;
    default:
      return !state.players[state.activePlayerId]?.isEliminated;
  }
}

/** Drops combat and response bookkeeping that names a player who is now out,
 * so the phase machine can never hand priority to — or resolve a fight for —
 * an eliminated player. Their Royals have already been swept to the Abyss. */
function pruneEliminatedFromCombat(state: GameState): GameState {
  const dead = (id: string | undefined): boolean =>
    id !== undefined && state.players[id]?.isEliminated === true;

  const duelContext =
    state.duelContext &&
    (dead(state.duelContext.attackerPlayerId) || dead(state.duelContext.defenderPlayerId))
      ? undefined
      : state.duelContext;

  return {
    ...state,
    attacks: state.attacks.filter(
      (a) => !dead(a.attackerPlayerId) && !dead(a.targetPlayerId),
    ),
    pendingBlockDefenders: state.pendingBlockDefenders?.filter((id) => !dead(id)),
    duelQueue: state.duelQueue?.filter((id) => !dead(id)),
    duelContext,
    pendingClubDebuff: dead(state.pendingClubDebuff?.targetPlayerId)
      ? undefined
      : state.pendingClubDebuff,
  };
}

/**
 * State-based actions, applied after every dispatched action: a player at 0
 * life is eliminated immediately, and the game ends the moment one player is
 * left standing.
 *
 * Elimination used to be checked only in endTurnCleanupAndAdvance, so a player
 * driven to 0 stayed in the game — still targetable, and still able to
 * interrupt with a Heart to heal back above 0 — until the current turn ended.
 * A game was therefore not decided at the moment the killing blow landed.
 *
 * Idempotent: with nobody newly at 0 life it returns the state unchanged, so
 * wrapping every dispatch costs one scan and no allocation.
 */
export function applyStateBasedActions(state: GameState): GameState {
  const newlyDead = state.turnOrder.filter((id) => {
    const player = state.players[id];
    return player !== undefined && !player.isEliminated && player.life <= 0;
  });
  if (newlyDead.length === 0) return state;

  let current = state;
  for (const playerId of newlyDead) {
    current = eliminatePlayerIfNeeded(current, playerId);
  }
  current = pruneEliminatedFromCombat(current);

  if (isGameOver(current)) {
    return {
      ...current,
      phase: "end_turn",
      activePlayerId: getWinner(current) ?? current.activePlayerId,
      attacks: [],
      hasAttackedThisTurn: false,
      duelContext: undefined,
      duelQueue: undefined,
      pendingBlockDefenders: undefined,
      pendingClubDebuff: undefined,
    };
  }

  // The game continues (3-4 players). If pruning left the game parked in a
  // phase whose priority holder just died, unwind to a phase somebody holds.
  if (!phaseHasHolder(current)) {
    const unwound: GameState = {
      ...current,
      attacks: [],
      hasAttackedThisTurn: false,
      duelContext: undefined,
      duelQueue: undefined,
      pendingBlockDefenders: undefined,
      pendingClubDebuff: undefined,
    };
    if (!unwound.players[unwound.activePlayerId]?.isEliminated) {
      return { ...unwound, phase: "main" };
    }
    const advanced = advanceTurn(unwound);
    return advanced.ok ? advanced.value : { ...unwound, phase: "main" };
  }

  return current;
}

export function getWinner(state: GameState): string | null {
  const active = state.turnOrder.filter(
    (id) => !state.players[id]?.isEliminated,
  );
  return active.length === 1 ? active[0]! : null;
}
