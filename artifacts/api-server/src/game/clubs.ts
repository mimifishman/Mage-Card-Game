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

export function applyClubToRoyal(
  state: GameState,
  playerId: string,
  cardId: CardId,
  targetPlayerId: string,
  targetCardId: CardId,
): Result<GameState> {
  const canPlay = canPlayCard(state, playerId, cardId);
  if (!canPlay.ok) return canPlay as Result<GameState>;

  const card = getCard(cardId);
  if (card.suit !== "C" || card.isRoyal) {
    return err(`Card ${cardId} is not a non-Royal Club`);
  }
  if (targetPlayerId === playerId) {
    return err("Cannot use Club on your own Royal");
  }

  const targetPlayer = state.players[targetPlayerId];
  if (!targetPlayer) return err(`Player ${targetPlayerId} not found`);

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

  const player = state.players[playerId]!;
  const withoutCard = { ...player, hand: player.hand.filter((c) => c !== cardId) };
  const afterSpend = spendVault(withoutCard, card.vaultCost);

  let updatedTargetPlayer: PlayerState;
  let updatedAbyss = [...state.abyss, cardId];

  const hp = effectiveHealth(debuffedRoyal);

  if (hp <= 0) {
    const result = destroyRoyalToAbyss(targetPlayer, targetCardId, updatedAbyss);
    updatedTargetPlayer = result.player;
    updatedAbyss = result.abyss;
  } else {
    const updatedCourt = [...targetPlayer.court];
    updatedCourt[royalIdx] = debuffedRoyal;
    updatedTargetPlayer = { ...targetPlayer, court: updatedCourt };
  }

  return ok({
    ...state,
    abyss: updatedAbyss,
    players: {
      ...state.players,
      [playerId]: afterSpend,
      [targetPlayerId]: updatedTargetPlayer,
    },
  });
}
