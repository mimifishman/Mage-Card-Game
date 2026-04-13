import { getCard } from "./cards";
import type { CardId, GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";
import { addTempBoost } from "./vault";
import { drawCard } from "./draw";
import { canPlayCard } from "./validation";

export function discardToAbyss(
  state: GameState,
  playerId: string,
  cardId: CardId,
): Result<GameState> {
  if (state.activePlayerId !== playerId) {
    return err("It is not your turn");
  }
  if (state.phase !== "main") {
    return err(`Cannot discard during phase "${state.phase}"`);
  }
  const player = state.players[playerId];
  if (!player) return err(`Player ${playerId} not found`);
  if (!player.hand.includes(cardId)) {
    return err(`Card ${cardId} is not in your hand`);
  }

  const card = getCard(cardId);
  if (card.isRoyal) {
    return err(`Royal cards cannot be discarded to the Abyss`);
  }

  const withoutCard: PlayerState = {
    ...player,
    hand: player.hand.filter((c) => c !== cardId),
  };

  return ok({
    ...state,
    abyss: [...state.abyss, cardId],
    players: { ...state.players, [playerId]: withoutCard },
  });
}

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
  if (player.hasPlayedDiamondThisTurn) {
    return err("You can only take one Diamond action per turn");
  }

  const updated: PlayerState = {
    ...removeFromHand(player, cardId),
    hasPlayedDiamondThisTurn: true,
  };

  return ok({
    ...state,
    mine: [...state.mine, cardId],
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
  if (player.hasPlayedDiamondThisTurn) {
    return err("You can only take one Diamond action per turn");
  }

  const withoutCard: PlayerState = {
    ...removeFromHand(player, cardId),
    hasPlayedDiamondThisTurn: true,
  };

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
  if (player.hasPlayedDiamondThisTurn) {
    return err("You can only take one Diamond action per turn");
  }

  const withoutCard = removeFromHand(player, cardId);
  const boosted = addTempBoost({ ...withoutCard, hasPlayedDiamondThisTurn: true }, card.pipValue);

  return ok({
    ...state,
    players: { ...state.players, [playerId]: boosted },
    abyss: [...state.abyss, cardId],
  });
}
