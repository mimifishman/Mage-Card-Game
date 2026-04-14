import type { GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";
import { drawCard } from "./draw";
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

  const nextPlayerBase = resetVaultForTurn(state.players[nextPlayerId]!);
  const isFirstTurn = !nextPlayerBase.hasHadFirstTurn;
  const nextPlayer: PlayerState = {
    ...nextPlayerBase,
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
      [nextPlayerId]: nextPlayer,
    },
  };

  if (isFirstTurn) {
    return ok(preparedState);
  }
  return drawCard(preparedState, nextPlayerId);
}

function healAllRoyals(state: GameState): {
  state: GameState;
  abyss: string[];
} {
  const updatedPlayers: Record<string, PlayerState> = { ...state.players };
  const discarded: string[] = [];

  for (const [playerId, player] of Object.entries(state.players)) {
    if (player.isEliminated) continue;

    const healedCourt = player.court.map((r) => ({
      ...r,
      damageTaken: 0,
      hasteLocked: false,
      hasAttackedThisTurn: false,
    }));

    updatedPlayers[playerId] = { ...player, court: healedCourt };
  }

  const activePlayerId = state.activePlayerId;
  const activePlayer = updatedPlayers[activePlayerId];

  if (activePlayer) {
    let hand = [...activePlayer.hand];

    if (hand.length > MAX_HAND_SIZE) {
      const excess = hand.slice(MAX_HAND_SIZE);
      discarded.push(...excess);
      hand = hand.slice(0, MAX_HAND_SIZE);
    }

    updatedPlayers[activePlayerId] = { ...activePlayer, hand };
  }

  return {
    state: { ...state, players: updatedPlayers },
    abyss: discarded,
  };
}

export function endTurn(state: GameState): Result<GameState> {
  if (
    state.phase !== "end_turn" &&
    state.phase !== "resolve_combat" &&
    state.phase !== "declare_attacks" &&
    state.phase !== "declare_blocks" &&
    state.phase !== "main"
  ) {
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
    return ok({
      ...current,
      phase: "end_turn",
      activePlayerId: winnerId ?? current.activePlayerId,
    });
  }

  const { state: healed, abyss: discarded } = healAllRoyals(current);

  current = {
    ...healed,
    abyss: [...healed.abyss, ...discarded],
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
