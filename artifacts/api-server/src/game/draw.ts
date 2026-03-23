import { shuffle } from "./cards";
import type { GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";

function reshuffleAbyssIntoDeck(state: GameState): GameState {
  if (state.abyss.length === 0) {
    return state;
  }
  return {
    ...state,
    deck: shuffle(state.abyss),
    abyss: [],
  };
}

export function drawCard(
  state: GameState,
  playerId: string,
): Result<GameState> {
  const player = state.players[playerId];
  if (!player) return err(`Player ${playerId} not found`);

  let current = state;
  if (current.deck.length === 0) {
    current = reshuffleAbyssIntoDeck(current);
    if (current.deck.length === 0) {
      return err("Deck and Abyss are both empty — no cards to draw");
    }
  }

  const [topCard, ...remainingDeck] = current.deck;
  const updatedPlayer: PlayerState = {
    ...player,
    hand: [...player.hand, topCard!],
  };

  return ok({
    ...current,
    deck: remainingDeck,
    players: { ...current.players, [playerId]: updatedPlayer },
  });
}

export function drawCards(
  state: GameState,
  playerId: string,
  count: number,
): Result<GameState> {
  let current = state;
  for (let i = 0; i < count; i++) {
    const result = drawCard(current, playerId);
    if (!result.ok) return result;
    current = result.value;
  }
  return ok(current);
}
