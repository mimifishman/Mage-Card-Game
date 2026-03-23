import { getCard } from "./cards";
import type { CardId, GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";
import { availableVault, spendVault } from "./vault";
import { canPlayCard } from "./validation";

const JOKER_COST = 10;

function destroyRoyalToAbyss(
  player: PlayerState,
  royalCardId: CardId,
  abyss: CardId[],
): { player: PlayerState; abyss: CardId[] } {
  const royal = player.court.find((r) => r.cardId === royalCardId);
  if (!royal) return { player, abyss };
  const destroyed = [royal.cardId, ...royal.attachedCards];
  return {
    player: {
      ...player,
      court: player.court.filter((r) => r.cardId !== royalCardId),
    },
    abyss: [...abyss, ...destroyed],
  };
}

export function playJokerDestroyRoyal(
  state: GameState,
  playerId: string,
  jokerCardId: CardId,
  targetPlayerId: string,
  targetCardId: CardId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, jokerCardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const joker = getCard(jokerCardId);
  if (!joker.isJoker) return err(`Card ${jokerCardId} is not a Joker`);

  const player = state.players[playerId]!;
  if (availableVault(player) < JOKER_COST) {
    return err(`Joker requires ${JOKER_COST} Vault; you have ${availableVault(player)}`);
  }

  const targetPlayer = state.players[targetPlayerId];
  if (!targetPlayer) return err(`Player ${targetPlayerId} not found`);

  const royalExists = targetPlayer.court.some((r) => r.cardId === targetCardId);
  if (!royalExists) {
    return err(`Royal ${targetCardId} is not in ${targetPlayerId}'s Court`);
  }

  const withoutJoker = { ...player, hand: player.hand.filter((c) => c !== jokerCardId) };
  const afterSpend = spendVault(withoutJoker, JOKER_COST);

  let updatedAbyss = [...state.abyss, jokerCardId];
  const { player: updatedTarget, abyss } = destroyRoyalToAbyss(
    targetPlayer,
    targetCardId,
    updatedAbyss,
  );
  updatedAbyss = abyss;

  return ok({
    ...state,
    abyss: updatedAbyss,
    players: {
      ...state.players,
      [playerId]: afterSpend,
      [targetPlayerId]: updatedTarget,
    },
  });
}

export function playJokerDamagePlayer(
  state: GameState,
  playerId: string,
  jokerCardId: CardId,
  targetPlayerId: string,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, jokerCardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const joker = getCard(jokerCardId);
  if (!joker.isJoker) return err(`Card ${jokerCardId} is not a Joker`);

  const player = state.players[playerId]!;
  if (availableVault(player) < JOKER_COST) {
    return err(`Joker requires ${JOKER_COST} Vault; you have ${availableVault(player)}`);
  }

  const targetPlayer = state.players[targetPlayerId];
  if (!targetPlayer) return err(`Player ${targetPlayerId} not found`);
  if (targetPlayerId === playerId) {
    return err("Cannot target yourself with Joker damage");
  }

  const withoutJoker = { ...player, hand: player.hand.filter((c) => c !== jokerCardId) };
  const afterSpend = spendVault(withoutJoker, JOKER_COST);

  const updatedTarget: PlayerState = {
    ...targetPlayer,
    life: targetPlayer.life - JOKER_COST,
  };

  return ok({
    ...state,
    abyss: [...state.abyss, jokerCardId],
    players: {
      ...state.players,
      [playerId]: afterSpend,
      [targetPlayerId]: updatedTarget,
    },
  });
}
