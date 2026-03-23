import { getCard } from "./cards";
import type { CardId, GameState, Result, TurnPhase } from "./types";
import { err, ok } from "./types";
import { availableVault } from "./vault";

const PLAY_PHASES: TurnPhase[] = ["main", "declare_attacks"];

export function canPlayCard(
  state: GameState,
  playerId: string,
  cardId: CardId,
): Result<true> {
  if (state.activePlayerId !== playerId) {
    return err("It is not your turn");
  }

  if (!PLAY_PHASES.includes(state.phase)) {
    return err(`Cannot play cards during phase "${state.phase}"`);
  }

  const player = state.players[playerId];
  if (!player) return err(`Player ${playerId} not found`);

  if (!player.hand.includes(cardId)) {
    return err(`Card ${cardId} is not in your hand`);
  }

  const card = getCard(cardId);
  const vault = availableVault(player);

  if (vault < card.vaultCost) {
    return err(
      `Not enough vault: need ${card.vaultCost}, have ${vault}`,
    );
  }

  return ok(true);
}
