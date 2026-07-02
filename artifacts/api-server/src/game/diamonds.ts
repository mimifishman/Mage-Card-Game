import { getCard } from "./cards";
import type { CardId, GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";
import { addTempBoost } from "./vault";
import { drawCard } from "./draw";
import { canPlayCard, isDuelPhase } from "./validation";

export function discardToAbyss(
  state: GameState,
  playerId: string,
  cardId: CardId,
): Result<GameState> {
  if (!isDuelPhase(state.phase)) {
    if (state.activePlayerId !== playerId) {
      return err("It is not your turn");
    }
    if (state.phase !== "main") {
      return err(`Cannot discard during phase "${state.phase}"`);
    }
  }

  const canPlay = canPlayCard(state, playerId, cardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

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
  if (state.phase === "declare_blocks") {
    return err(`Cannot play a Diamond to the Mine during phase "declare_blocks"`);
  }
  if (state.phase === "respond_to_club") {
    return err(`Cannot send Diamonds to the Mine during a Club response window`);
  }
  if (isDuelPhase(state.phase)) {
    return err(`Cannot play a Diamond to the Mine during a duel phase`);
  }

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
  if (state.phase === "declare_blocks") {
    return err(`Cannot use a Diamond action during phase "declare_blocks"`);
  }

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

  if (state.phase === "respond_to_club") {
    const pending = state.pendingClubDebuff!;
    if (pending.defenderDiamondUsed) {
      return err("You have already used your one Diamond action during this Club response");
    }
    const withoutCard = removeFromHand(player, cardId);
    const afterDiscard: GameState = {
      ...state,
      players: { ...state.players, [playerId]: withoutCard },
      abyss: [...state.abyss, cardId],
      pendingClubDebuff: { ...pending, defenderDiamondUsed: true },
    };
    return drawCard(afterDiscard, playerId);
  }

  if (isDuelPhase(state.phase) && state.duelContext) {
    const ctx = state.duelContext;
    const isAttacker = playerId === ctx.attackerPlayerId;
    const diamondUsed = isAttacker ? ctx.attackerDiamondUsed : ctx.defenderDiamondUsed;
    if (diamondUsed) {
      return err("You have already used your Diamond action this duel");
    }
    const withoutCard: PlayerState = removeFromHand(player, cardId);
    const afterDiscard: GameState = {
      ...state,
      players: { ...state.players, [playerId]: withoutCard },
      abyss: [...state.abyss, cardId],
      duelContext: {
        ...ctx,
        attackerDiamondUsed: isAttacker ? true : ctx.attackerDiamondUsed,
        defenderDiamondUsed: !isAttacker ? true : ctx.defenderDiamondUsed,
      },
    };
    return drawCard(afterDiscard, playerId);
  }

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
  targetPlayerId: string = playerId,
): Result<GameState> {
  if (state.phase === "declare_blocks") {
    return err(`Cannot use a Diamond action during phase "declare_blocks"`);
  }

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
  const targetPlayer = state.players[targetPlayerId];
  if (!targetPlayer) return err(`Player ${targetPlayerId} not found`);

  const applyBoost = (updatedActingPlayer: PlayerState): Record<string, PlayerState> => {
    if (targetPlayerId === playerId) {
      return { [playerId]: addTempBoost(updatedActingPlayer, card.pipValue) };
    }
    return {
      [playerId]: updatedActingPlayer,
      [targetPlayerId]: addTempBoost(targetPlayer, card.pipValue),
    };
  };

  if (state.phase === "respond_to_club") {
    const pending = state.pendingClubDebuff!;
    if (pending.defenderDiamondUsed) {
      return err("You have already used your one Diamond action during this Club response");
    }
    const withoutCard = removeFromHand(player, cardId);
    return ok({
      ...state,
      players: { ...state.players, ...applyBoost(withoutCard) },
      abyss: [...state.abyss, cardId],
      pendingClubDebuff: { ...pending, defenderDiamondUsed: true },
    });
  }

  if (isDuelPhase(state.phase) && state.duelContext) {
    const ctx = state.duelContext;
    const isAttacker = playerId === ctx.attackerPlayerId;
    const diamondUsed = isAttacker ? ctx.attackerDiamondUsed : ctx.defenderDiamondUsed;
    if (diamondUsed) {
      return err("You have already used your Diamond action this duel");
    }
    const withoutCard = removeFromHand(player, cardId);
    const updatedState: GameState = {
      ...state,
      players: { ...state.players, ...applyBoost(withoutCard) },
      abyss: [...state.abyss, cardId],
      duelContext: {
        ...ctx,
        attackerDiamondUsed: isAttacker ? true : ctx.attackerDiamondUsed,
        defenderDiamondUsed: !isAttacker ? true : ctx.defenderDiamondUsed,
      },
    };
    return ok(updatedState);
  }

  if (player.hasPlayedDiamondThisTurn) {
    return err("You can only take one Diamond action per turn");
  }

  const withoutCard = {
    ...removeFromHand(player, cardId),
    hasPlayedDiamondThisTurn: true,
  };

  return ok({
    ...state,
    players: { ...state.players, ...applyBoost(withoutCard) },
    abyss: [...state.abyss, cardId],
  });
}
