import { getCard } from "./cards";
import type { CardId, GameState, Result, TurnPhase } from "./types";
import { err, ok } from "./types";
import { availableVault } from "./vault";

const PLAY_PHASES: TurnPhase[] = ["main", "declare_attacks"];
const DUEL_PHASES: TurnPhase[] = ["duel_attacker_turn", "duel_blocker_turn"];

export function isDuelPhase(phase: TurnPhase): boolean {
  return DUEL_PHASES.includes(phase);
}

export function canPlayCard(
  state: GameState,
  playerId: string,
  cardId: CardId,
): Result<true> {
  if (state.phase === "respond_to_club") {
    const pending = state.pendingClubDebuff;
    if (!pending) {
      return err(`No pending club debuff in respond_to_club phase`);
    }
    if (playerId !== pending.targetPlayerId) {
      return err(`Only the defending player can act during respond_to_club`);
    }

    const player = state.players[playerId];
    if (!player) return err(`Player ${playerId} not found`);

    if (!player.hand.includes(cardId)) {
      return err(`Card ${cardId} is not in your hand`);
    }

    const card = getCard(cardId);
    if (card.isRoyal) {
      return err(`Cannot play Royals during a Club response window`);
    }

    const vault = availableVault(state.mine, player);
    if (vault < card.vaultCost) {
      return err(`Not enough vault: need ${card.vaultCost}, have ${vault}`);
    }

    return ok(true);
  }

  if (state.phase === "declare_blocks") {
    const isTargetedDefender = state.attacks.some((a) => a.targetPlayerId === playerId);
    if (!isTargetedDefender) {
      return err(`Cannot play cards during phase "declare_blocks"`);
    }
    if (state.pendingBlockDefenders && !state.pendingBlockDefenders.includes(playerId)) {
      return err("You have already submitted your blocks and cannot play more cards");
    }
  } else if (isDuelPhase(state.phase)) {
    const ctx = state.duelContext;
    if (!ctx) {
      return err(`No duel context found during duel phase`);
    }
    if (state.phase === "duel_attacker_turn" && playerId !== ctx.attackerPlayerId) {
      return err("It is the attacker's turn in the duel");
    }
    if (state.phase === "duel_blocker_turn" && playerId !== ctx.defenderPlayerId) {
      return err("It is the blocker's turn in the duel");
    }
  } else {
    if (state.activePlayerId !== playerId) {
      return err("It is not your turn");
    }

    if (!PLAY_PHASES.includes(state.phase)) {
      return err(`Cannot play cards during phase "${state.phase}"`);
    }
  }

  const player = state.players[playerId];
  if (!player) return err(`Player ${playerId} not found`);

  if (!player.hand.includes(cardId)) {
    return err(`Card ${cardId} is not in your hand`);
  }

  const card = getCard(cardId);
  const vault = availableVault(state.mine, player);

  if (vault < card.vaultCost) {
    return err(
      `Not enough vault: need ${card.vaultCost}, have ${vault}`,
    );
  }

  return ok(true);
}
