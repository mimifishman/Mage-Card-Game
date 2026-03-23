import { getCard } from "./cards";
import type { CardId, GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";
import { addTempBoost } from "./vault";
import { drawCard } from "./draw";
import { canPlayCard } from "./validation";

function removeFromHand(player: PlayerState, cardId: CardId): PlayerState {
  return {
    ...player,
    hand: player.hand.filter((c) => c !== cardId),
  };
}

export function playDiamondToMine(
  state: GameState,
  playerId: string,
  cardId: CardId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, cardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const card = getCard(cardId);
  if (card.suit !== "D") {
    return err(`Card ${cardId} is not a Diamond`);
  }
  if (card.isRoyal) {
    return err(`Royal cards cannot be played to Mine`);
  }

  const player = state.players[playerId]!;
  const updated: PlayerState = {
    ...removeFromHand(player, cardId),
    mine: [...player.mine, cardId],
    vault: {
      ...player.vault,
      base: player.vault.base + card.pipValue,
    },
  };

  return ok({
    ...state,
    players: { ...state.players, [playerId]: updated },
  });
}

export function discardDiamondToDraw(
  state: GameState,
  playerId: string,
  cardId: CardId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, cardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const card = getCard(cardId);
  if (card.suit !== "D") {
    return err(`Card ${cardId} is not a Diamond`);
  }
  if (card.isRoyal) {
    return err(`Royal cards cannot be discarded as Diamonds`);
  }

  const player = state.players[playerId]!;
  const withoutCard: PlayerState = removeFromHand(player, cardId);

  const afterDiscard: GameState = {
    ...state,
    players: { ...state.players, [playerId]: withoutCard },
    abyss: [...state.abyss, cardId],
  };

  return drawCard(afterDiscard, playerId);
}

export function discardDiamondForBoost(
  state: GameState,
  playerId: string,
  cardId: CardId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, cardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const card = getCard(cardId);
  if (card.suit !== "D") {
    return err(`Card ${cardId} is not a Diamond`);
  }
  if (card.isRoyal) {
    return err(`Royal cards cannot be discarded as Diamonds`);
  }

  const player = state.players[playerId]!;
  const withoutCard = removeFromHand(player, cardId);
  const boosted = addTempBoost(withoutCard, card.pipValue);

  return ok({
    ...state,
    players: { ...state.players, [playerId]: boosted },
    abyss: [...state.abyss, cardId],
  });
}
