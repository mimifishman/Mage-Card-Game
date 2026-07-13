import { fullDeck, getCard, shuffle } from "./cards";
import { drawCards } from "./draw";
import { calculateVaultFromMine } from "./vault";
import type { CardId, GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";

const INITIAL_HAND_SIZE = 7;
const DEFAULT_LIFE = 20;

export function createInitialGameState(
  matchId: string,
  playerIds: string[],
  displayNames: Record<string, string> = {},
): Result<GameState> {
  if (playerIds.length < 2 || playerIds.length > 4) {
    return err("Game requires 2-4 players");
  }

  const deck = shuffle(fullDeck());

  const players: Record<string, PlayerState> = {};
  for (const id of playerIds) {
    players[id] = {
      id,
      displayName: displayNames[id] || id,
      life: DEFAULT_LIFE,
      isEliminated: false,
      hand: [],
      court: [],
      vault: { tempBoost: 0, spent: 0 },
      hasPlayedDiamondThisTurn: false,
      hasHadFirstTurn: false,
    };
  }

  return ok({
    matchId,
    phase: "main",
    turnNumber: 1,
    activePlayerId: playerIds[0]!,
    turnOrder: [...playerIds],
    players,
    deck,
    mine: [],
    abyss: [],
    attacks: [],
    hasAttackedThisTurn: false,
  });
}

export function dealInitialHands(state: GameState): Result<GameState> {
  let current = state;
  for (const playerId of current.turnOrder) {
    const result = drawCards(current, playerId, INITIAL_HAND_SIZE);
    if (!result.ok) return result;
    current = result.value;
  }
  // Mark the first player and freeze every OTHER player's Vault at the
  // starting Mine total (0), so Diamonds the first player banks this turn
  // don't raise the others' Vaults before their own first turn. The active
  // player leaves frozenMineTotal undefined and tracks the live Mine.
  const activeId = current.activePlayerId;
  const startMineTotal = calculateVaultFromMine(current.mine);
  const updatedPlayers: Record<string, PlayerState> = { ...current.players };
  for (const [id, p] of Object.entries(updatedPlayers)) {
    updatedPlayers[id] =
      id === activeId
        ? { ...p, hasHadFirstTurn: true }
        : { ...p, vault: { ...p.vault, frozenMineTotal: startMineTotal } };
  }
  current = { ...current, players: updatedPlayers };
  return ok(current);
}

function rankValue(cardId: CardId): number {
  const card = getCard(cardId);
  return card.pipValue;
}

export function determineFirstPlayer(state: GameState): Result<GameState> {
  let currentState = state;
  let contenders = [...state.turnOrder];
  const revealedCards: CardId[] = [];

  while (true) {
    const roundDraws: Record<string, CardId> = {};

    for (const playerId of contenders) {
      if (currentState.deck.length === 0) {
        return err("No cards left to determine first player");
      }

      const [topCard, ...remaining] = currentState.deck;

      if (!topCard) {
        return err("No cards left to determine first player");
      }

      roundDraws[playerId] = topCard;
      revealedCards.push(topCard);

      currentState = {
        ...currentState,
        deck: remaining,
      };
    }

    const ranked = contenders
      .map((playerId) => ({
        playerId,
        value: rankValue(roundDraws[playerId]!),
      }))
      .sort((a, b) => b.value - a.value);

    const topValue = ranked[0]!.value;
    const tied = ranked.filter((r) => r.value === topValue);

    if (tied.length === 1) {
      return ok({
        ...currentState,
        activePlayerId: ranked[0]!.playerId,
        deck: shuffle([...currentState.deck, ...revealedCards]),
        abyss: [],
      });
    }

    contenders = tied.map((t) => t.playerId);
  }
}
