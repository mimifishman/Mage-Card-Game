import { fullDeck, getCard, shuffle } from "./cards";
import { drawCards } from "./draw";
import type { CardId, GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";

const INITIAL_HAND_SIZE = 7;
const DEFAULT_LIFE = 20;

export function createInitialGameState(
  matchId: string,
  playerIds: string[],
): Result<GameState> {
  if (playerIds.length < 2 || playerIds.length > 4) {
    return err("Game requires 2-4 players");
  }

  const deck = shuffle(fullDeck());

  const players: Record<string, PlayerState> = {};
  for (const id of playerIds) {
    players[id] = {
      id,
      life: DEFAULT_LIFE,
      isEliminated: false,
      hand: [],
      court: [],
      mine: [],
      vault: { tempBoost: 0, spent: 0 },
      hasPlayedDiamondThisTurn: false,
    };
  }

  return ok({
    matchId,
    phase: "draw",
    turnNumber: 1,
    activePlayerId: playerIds[0]!,
    turnOrder: [...playerIds],
    players,
    deck,
    abyss: [],
    attacks: [],
  });
}

export function dealInitialHands(state: GameState): Result<GameState> {
  let current = state;
  for (const playerId of current.turnOrder) {
    const result = drawCards(current, playerId, INITIAL_HAND_SIZE);
    if (!result.ok) return result;
    current = result.value;
  }
  return ok(current);
}

function rankValue(cardId: CardId): number {
  const card = getCard(cardId);
  return card.pipValue;
}

export function determineFirstPlayer(state: GameState): Result<GameState> {
  const playerIds = state.turnOrder;
  const drawnCards: Record<string, CardId> = {};
  let currentState = state;

  while (true) {
    for (const playerId of playerIds) {
      if (currentState.deck.length === 0) {
        if (currentState.abyss.length === 0) {
          return err("No cards left to determine first player");
        }
        currentState = {
          ...currentState,
          deck: shuffle(currentState.abyss),
          abyss: [],
        };
      }
      const [topCard, ...remaining] = currentState.deck;
      drawnCards[playerId] = topCard!;
      currentState = {
        ...currentState,
        deck: remaining,
        abyss: [...currentState.abyss, topCard!],
      };
    }

    const values = playerIds.map((id) => ({
      id,
      value: rankValue(drawnCards[id]!),
    }));
    const maxValue = Math.max(...values.map((v) => v.value));
    const winners = values.filter((v) => v.value === maxValue);

    if (winners.length === 1) {
      return ok({ ...currentState, activePlayerId: winners[0]!.id });
    }
  }
}
