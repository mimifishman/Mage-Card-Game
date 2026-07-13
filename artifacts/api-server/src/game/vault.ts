import { getCard } from "./cards";
import type { CardId, PlayerState } from "./types";

export function calculateVaultFromMine(mine: CardId[]): number {
  return mine.reduce((sum, cardId) => {
    const card = getCard(cardId);
    return sum + card.pipValue;
  }, 0);
}

export function availableVault(mine: CardId[], player: PlayerState): number {
  // Non-active players are frozen at the Mine total captured when their turn
  // ended; the active player (frozenMineTotal undefined) tracks the live Mine.
  const base = player.vault.frozenMineTotal ?? calculateVaultFromMine(mine);
  return base + player.vault.tempBoost - player.vault.spent;
}

export function spendVault(player: PlayerState, amount: number): PlayerState {
  return {
    ...player,
    vault: { ...player.vault, spent: player.vault.spent + amount },
  };
}

export function addTempBoost(player: PlayerState, amount: number): PlayerState {
  return {
    ...player,
    vault: { ...player.vault, tempBoost: player.vault.tempBoost + amount },
  };
}

export function resetVaultForTurn(player: PlayerState): PlayerState {
  return {
    ...player,
    vault: { tempBoost: 0, spent: 0 },
  };
}
