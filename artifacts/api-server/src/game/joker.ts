import { getCard } from "./cards";
import type { CardId, GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";
import { availableVault, spendVault } from "./vault";
import { canPlayCard, isDuelPhase } from "./validation";
import { isRoyalInActiveDuelPair, isRoyalInResolvedDuelPair } from "./combat";

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
  if (availableVault(state.mine, player) < JOKER_COST) {
    return err(`Joker requires ${JOKER_COST} Vault; you have ${availableVault(state.mine, player)}`);
  }

  const targetPlayer = state.players[targetPlayerId];
  if (!targetPlayer) return err(`Player ${targetPlayerId} not found`);

  const targetRoyal = targetPlayer.court.find((r) => r.cardId === targetCardId);
  if (!targetRoyal) {
    return err(`Royal ${targetCardId} is not in ${targetPlayerId}'s Court`);
  }

  if (isDuelPhase(state.phase) && state.attacks.some((a) => a.blockerCardIds?.length)) {
    if (!isRoyalInActiveDuelPair(state, targetCardId)) {
      if (isRoyalInResolvedDuelPair(state, targetCardId)) {
        return err("Cannot target a Royal in a pair whose duel has already ended");
      }
      return err("Can only target a Royal that is part of an active duel pair");
    }
  }

  const withoutJoker = { ...player, hand: player.hand.filter((c) => c !== jokerCardId) };
  const afterSpend = spendVault(withoutJoker, JOKER_COST);

  let updatedAbyss = [...state.abyss, jokerCardId];
  const { player: destroyedTarget, abyss } = destroyRoyalToAbyss(
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
      [targetPlayerId]: destroyedTarget,
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
  if (availableVault(state.mine, player) < JOKER_COST) {
    return err(`Joker requires ${JOKER_COST} Vault; you have ${availableVault(state.mine, player)}`);
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

export type JokerMode = "destroy_royal" | "damage_player";

export function playJoker(
  state: GameState,
  playerId: string,
  jokerCardId: CardId,
  mode: JokerMode,
  targetPlayerId: string,
  targetCardId?: CardId,
): Result<GameState> {
  if (mode === "destroy_royal") {
    if (!targetCardId) {
      return err('mode "destroy_royal" requires a targetCardId');
    }
    return playJokerDestroyRoyal(state, playerId, jokerCardId, targetPlayerId, targetCardId);
  }
  return playJokerDamagePlayer(state, playerId, jokerCardId, targetPlayerId);
}
