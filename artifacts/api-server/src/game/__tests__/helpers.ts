import type { GameState, PlayerState } from "../types";

export const P1 = "player-1";
export const P2 = "player-2";

export function makePlayer(
  id: string,
  overrides: Partial<PlayerState> = {},
): PlayerState {
  return {
    id,
    life: 20,
    isEliminated: false,
    hand: [],
    court: [],
    mine: [],
    vault: { base: 0, tempBoost: 0, spent: 0 },
    ...overrides,
  };
}

export function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    matchId: "test-match",
    phase: "main",
    turnNumber: 1,
    activePlayerId: P1,
    turnOrder: [P1, P2],
    players: {
      [P1]: makePlayer(P1),
      [P2]: makePlayer(P2),
    },
    deck: [],
    abyss: [],
    attacks: [],
    ...overrides,
  };
}
