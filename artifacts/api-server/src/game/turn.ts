import type { GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";
import { resetVaultForTurn } from "./vault";

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

  return {
    ...state,
    players: { ...state.players, [playerId]: eliminated },
    abyss: [...state.abyss, ...allCards],
  };
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

  const nextPlayer = resetVaultForTurn(state.players[nextPlayerId]!);

  return ok({
    ...state,
    phase: "draw",
    turnNumber: state.turnNumber + 1,
    activePlayerId: nextPlayerId,
    players: { ...state.players, [nextPlayerId]: nextPlayer },
  });
}

export function endTurn(state: GameState): Result<GameState> {
  if (state.phase !== "end_turn" && state.phase !== "resolve_combat" && state.phase !== "declare_attacks" && state.phase !== "main") {
    return err(`Cannot end turn during phase "${state.phase}"`);
  }

  let current = state;

  for (const playerId of current.turnOrder) {
    current = eliminatePlayerIfNeeded(current, playerId);
  }

  const active = current.turnOrder.filter(
    (id) => !current.players[id]?.isEliminated,
  );

  if (active.length <= 1) {
    const winnerId = active[0] ?? null;
    return ok({ ...current, phase: "end_turn", activePlayerId: winnerId ?? current.activePlayerId });
  }

  const playerId = current.activePlayerId;
  const player = current.players[playerId]!;

  const healedCourt = player.court.map((r) => ({
    ...r,
    damageTaken: 0,
    hasteLocked: false,
    hasAttackedThisTurn: false,
  }));

  let hand = [...player.hand];
  let discardToAbyss: string[] = [];
  if (hand.length > MAX_HAND_SIZE) {
    discardToAbyss = hand.slice(MAX_HAND_SIZE);
    hand = hand.slice(0, MAX_HAND_SIZE);
  }

  const updatedPlayer: PlayerState = {
    ...player,
    court: healedCourt,
    hand,
  };

  current = {
    ...current,
    abyss: [...current.abyss, ...discardToAbyss],
    players: { ...current.players, [playerId]: updatedPlayer },
    attacks: [],
  };

  return advanceTurn(current);
}

export function isGameOver(state: GameState): boolean {
  const active = state.turnOrder.filter(
    (id) => !state.players[id]?.isEliminated,
  );
  return active.length <= 1;
}

export function getWinner(state: GameState): string | null {
  const active = state.turnOrder.filter(
    (id) => !state.players[id]?.isEliminated,
  );
  return active.length === 1 ? active[0]! : null;
}
