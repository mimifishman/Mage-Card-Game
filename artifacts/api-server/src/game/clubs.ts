import { effectiveHealth, getCard } from "./cards";
import type { CardId, GameState, PlayerState, Result } from "./types";
import { err, ok } from "./types";
import { spendVault } from "./vault";
import { canPlayCard } from "./validation";

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

export function applyClub(
  state: GameState,
  playerId: string,
  cardId: CardId,
  targetPlayerId: string,
  targetCardId?: CardId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, cardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const card = getCard(cardId);
  if (card.suit !== "C" || card.isRoyal) {
    return err(`Card ${cardId} is not a non-Royal Club`);
  }
  if (targetPlayerId === playerId) {
    return err("Cannot use Club on yourself");
  }

  const targetPlayer = state.players[targetPlayerId];
  if (!targetPlayer) return err(`Player ${targetPlayerId} not found`);

  const player = state.players[playerId]!;
  const withoutCard = { ...player, hand: player.hand.filter((c) => c !== cardId) };
  const afterSpend = spendVault(withoutCard, card.vaultCost);
  const updatedAbyss = [...state.abyss, cardId];

  if (!targetCardId) {
    const damagedTarget: PlayerState = {
      ...targetPlayer,
      life: Math.max(0, targetPlayer.life - card.pipValue),
    };
    return ok({
      ...state,
      abyss: updatedAbyss,
      players: {
        ...state.players,
        [playerId]: afterSpend,
        [targetPlayerId]: damagedTarget,
      },
    });
  }

  const royalIdx = targetPlayer.court.findIndex((r) => r.cardId === targetCardId);
  if (royalIdx === -1) {
    return err(`Royal ${targetCardId} is not in ${targetPlayerId}'s Court`);
  }

  const royal = targetPlayer.court[royalIdx]!;
  const debuffedRoyal = {
    ...royal,
    buffAttack: royal.buffAttack - card.pipValue,
    buffHealth: royal.buffHealth - card.pipValue,
  };

  let updatedTargetPlayer: PlayerState;
  let currentAbyss = updatedAbyss;

  const hp = effectiveHealth(debuffedRoyal);

  if (hp <= 0) {
    const result = destroyRoyalToAbyss(targetPlayer, targetCardId, currentAbyss);
    updatedTargetPlayer = result.player;
    currentAbyss = result.abyss;
  } else {
    const updatedCourt = [...targetPlayer.court];
    updatedCourt[royalIdx] = debuffedRoyal;
    updatedTargetPlayer = { ...targetPlayer, court: updatedCourt };
  }

  return ok({
    ...state,
    abyss: currentAbyss,
    players: {
      ...state.players,
      [playerId]: afterSpend,
      [targetPlayerId]: updatedTargetPlayer,
    },
  });
}

export const applyClubToRoyal = applyClub;
