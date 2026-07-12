export type Suit = "H" | "S" | "D" | "C" | "JOKER";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7"
  | "8" | "9" | "10" | "J" | "Q" | "K" | "JOKER";

export interface ParsedCard {
  id: string;
  suit: Suit;
  rank: Rank;
  isRoyal: boolean;
  isJoker: boolean;
  displayRank: string;
  displaySuit: string;
  suitSymbol: string;
  suitColor: string;
  vaultCost: number;
  pipValue: number;
}

const ROYAL_RANKS: Rank[] = ["J", "Q", "K"];

function pipValue(rank: Rank): number {
  if (rank === "JOKER") return 0;
  if (rank === "A") return 1;
  if (rank === "J") return 1;
  if (rank === "Q") return 2;
  if (rank === "K") return 3;
  return parseInt(rank, 10);
}

function vaultCost(rank: Rank, suit: Suit): number {
  if (suit === "JOKER" || rank === "JOKER") return 10;
  const isRoyal = ROYAL_RANKS.includes(rank as Rank);
  if (suit === "D" && !isRoyal) return 0;
  return pipValue(rank);
}

export function parseCardId(id: string): ParsedCard {
  if (id.startsWith("JOKER")) {
    return {
      id,
      suit: "JOKER",
      rank: "JOKER",
      isRoyal: false,
      isJoker: true,
      displayRank: "JKR",
      displaySuit: "★",
      suitSymbol: "★",
      suitColor: "#C89B3C",
      vaultCost: 10,
      pipValue: 0,
    };
  }

  let suit: Suit;
  let rank: Rank;

  if (id.length === 2) {
    rank = id[0] as Rank;
    suit = id[1] as Suit;
  } else {
    rank = id.slice(0, id.length - 1) as Rank;
    suit = id[id.length - 1] as Suit;
  }

  const isRoyal = ROYAL_RANKS.includes(rank);

  const suitMap: Record<Suit, { symbol: string; color: string }> = {
    H: { symbol: "♥", color: "#C8102E" },
    S: { symbol: "♠", color: "#0D0D0D" },
    D: { symbol: "♦", color: "#1565C0" },
    C: { symbol: "♣", color: "#1B5E20" },
    JOKER: { symbol: "★", color: "#C89B3C" },
  };

  const { symbol, color } = suitMap[suit] ?? { symbol: "?", color: "#FFF" };

  return {
    id,
    suit,
    rank,
    isRoyal,
    isJoker: false,
    displayRank: rank,
    displaySuit: suit,
    suitSymbol: symbol,
    suitColor: color,
    vaultCost: vaultCost(rank, suit),
    pipValue: pipValue(rank),
  };
}

export function royalBaseAttack(rank: Rank): number {
  if (rank === "J") return 1;
  if (rank === "Q") return 2;
  return 3;
}

export function royalBaseHealth(rank: Rank): number {
  if (rank === "J") return 1;
  if (rank === "Q") return 2;
  return 3;
}

export function effectiveAttack(cardId: string, buffAttack: number): number {
  const card = parseCardId(cardId);
  if (!card.isRoyal) return 0;
  return royalBaseAttack(card.rank) + buffAttack;
}

export function effectiveHealth(
  cardId: string,
  buffHealth: number,
  damageTaken: number,
): number {
  const card = parseCardId(cardId);
  if (!card.isRoyal) return 0;
  return royalBaseHealth(card.rank) + buffHealth - damageTaken;
}

export type CardAction =
  | "play_diamond_to_mine"
  | "discard_diamond_to_draw"
  | "discard_diamond_for_boost"
  | "discard_to_abyss"
  | "play_royal_to_court"
  | "attach_royal_support"
  | "attach_heart"
  | "attach_spade"
  | "discard_heart_to_heal"
  | "discard_spade_to_return"
  | "apply_club"
  | "apply_club_damage"
  | "play_joker"
  | "discard_to_end_turn";

export interface ValidAction {
  action: CardAction;
  label: string;
  requiresTarget: boolean;
  disabled?: boolean;
  targetType?: "any_royal" | "any_player" | "pick_abyss";
  /** Compact tile presentation for the action dock. */
  icon?: string;
  /** Short verb shown under the icon (e.g. "To Mine"). Falls back to label. */
  short?: string;
  /** Small detail line under the verb (e.g. "+10 ⚡", "own turn only"). */
  detail?: string;
}

export function isDuelTurnPhase(phase: string): boolean {
  return phase === "duel_attacker_turn" || phase === "duel_blocker_turn";
}

export function isInterruptPhase(phase: string): boolean {
  return phase === "interrupt_window";
}

export interface InterruptInitiationContext {
  inDuel: boolean;
  isMyTurn: boolean;
  isMyDuelTurn: boolean;
  isDefender: boolean;
  isClubResponder: boolean;
  inInterrupt: boolean;
  amIEliminated: boolean;
}

/**
 * Whether the local player may OPEN a fresh interrupt window during another
 * player's turn/phase. Eliminated players and players already inside an
 * interrupt window never qualify. During a duel the game's activePlayerId
 * stays the original attacker, so `isMyTurn` alone cannot be used — the only
 * player barred from initiating while a duel is in progress is the current
 * duel turn-holder (so the *other* duel participant, and any bystander, may
 * still interrupt). Outside a duel, only a pure bystander (not the active
 * player, defender, or club responder) may initiate.
 */
export function canPlayerInitiateInterrupt(ctx: InterruptInitiationContext): boolean {
  if (ctx.amIEliminated || ctx.inInterrupt) return false;
  if (ctx.inDuel) return !ctx.isMyDuelTurn;
  return !ctx.isMyTurn && !ctx.isDefender && !ctx.isClubResponder;
}

export function getValidActionsForCard(
  card: ParsedCard,
  phase: string,
  isMyTurn: boolean,
  myCourtSize: number,
  vault: number,
  hasTakenDiamondAction = false,
  isDefender = false,
  isClubResponder = false,
  isMyDuelTurn = false,
  isMyInterruptTurn = false,
  canInitiateInterrupt = false,
  anyCourtHasRoyals: boolean = myCourtSize > 0,
): ValidAction[] {
  // An interrupt window offers the same eligible card actions as a duel turn
  // (no Royals, no Diamond-to-Mine, no attacks), so we reuse the duel branch.
  // A non-active bystander may also *initiate* an interrupt during another
  // player's turn/phase (canInitiateInterrupt), which opens an interrupt
  // window server-side — the eligible action set is identical.
  const inDuel = isDuelTurnPhase(phase) || isInterruptPhase(phase);

  if (inDuel || canInitiateInterrupt) {
    if (!isMyDuelTurn && !isMyInterruptTurn && !canInitiateInterrupt) return [];

    if (card.isRoyal) return [];
    if (card.isJoker) {
      if (vault >= 10) {
        return [
          {
            action: "play_joker",
            label: "Destroy a Royal (⚡10)",
            requiresTarget: true,
            targetType: "any_royal",
          },
          {
            action: "play_joker",
            label: "Deal 10 damage to a player (⚡10)",
            requiresTarget: true,
            targetType: "any_player",
          },
        ];
      }
      return [];
    }
    if (card.suit === "D") {
      if (hasTakenDiamondAction) return [];
      return [
        // Mine plays are never legal outside your own main phase — surface
        // that as a visible disabled chip instead of silently hiding it.
        {
          action: "play_diamond_to_mine",
          label: "Add to the Mine",
          icon: "💎",
          short: "To Mine",
          detail: isMyDuelTurn ? "not in a duel" : "your turn only",
          requiresTarget: false,
          disabled: true,
        },
        {
          action: "discard_diamond_to_draw",
          label: "Discard → draw a card",
          icon: "🎴",
          short: "Draw",
          detail: "1 card",
          requiresTarget: false,
        },
        {
          action: "discard_diamond_for_boost",
          label: `Boost a player: +${card.pipValue} Vault this turn`,
          icon: "⚡",
          short: "Boost",
          detail: `+${card.pipValue} ⚡`,
          requiresTarget: true,
          targetType: "any_player",
        },
      ];
    }
    if (card.suit === "H") {
      const actions: ValidAction[] = [];
      if (anyCourtHasRoyals && vault >= card.vaultCost) {
        actions.push({
          action: "attach_heart",
          label: `Attach: +${card.pipValue} health (⚡${card.vaultCost})`,
          requiresTarget: true,
          targetType: "any_royal",
        });
      } else if (anyCourtHasRoyals) {
        actions.push({
          action: "attach_heart",
          label: `Attach needs ⚡${card.vaultCost} — you have ⚡${vault}`,
          requiresTarget: false,
          disabled: true,
        });
      }
      if (vault >= card.vaultCost) {
        actions.push({
          action: "discard_heart_to_heal",
          label: `Heal a player: +${card.pipValue} life (⚡${card.vaultCost})`,
          requiresTarget: true,
          targetType: "any_player",
        });
      } else {
        actions.push({
          action: "discard_heart_to_heal",
          label: `Needs ⚡${card.vaultCost} — you have ⚡${vault}`,
          requiresTarget: false,
          disabled: true,
        });
      }
      return actions;
    }
    if (card.suit === "S") {
      const actions: ValidAction[] = [];
      if (anyCourtHasRoyals && vault >= card.vaultCost) {
        actions.push({
          action: "attach_spade",
          label: `Attach: +${card.pipValue} attack & defense (⚡${card.vaultCost})`,
          requiresTarget: true,
          targetType: "any_royal",
        });
      } else if (anyCourtHasRoyals) {
        actions.push({
          action: "attach_spade",
          label: `Attach needs ⚡${card.vaultCost} — you have ⚡${vault}`,
          requiresTarget: false,
          disabled: true,
        });
      }
      if (vault >= card.vaultCost) {
        actions.push({
          action: "discard_spade_to_return",
          label: `Reclaim from the Abyss (value ≤ ${card.pipValue}) (⚡${card.vaultCost})`,
          requiresTarget: true,
          targetType: "pick_abyss",
        });
      } else {
        actions.push({
          action: "discard_spade_to_return",
          label: `Needs ⚡${card.vaultCost} — you have ⚡${vault}`,
          requiresTarget: false,
          disabled: true,
        });
      }
      return actions;
    }
    if (card.suit === "C") {
      const actions: ValidAction[] = [];
      if (vault >= card.vaultCost) {
        actions.push({
          action: "apply_club",
          label: `Weaken a Royal: −${card.pipValue} attack & health (⚡${card.vaultCost})`,
          requiresTarget: true,
          targetType: "any_royal",
        });
        actions.push({
          action: "apply_club_damage",
          label: `Strike a player: ${card.pipValue} damage (⚡${card.vaultCost})`,
          requiresTarget: true,
          targetType: "any_player",
        });
      } else {
        actions.push({
          action: "apply_club",
          label: `Needs ⚡${card.vaultCost} — you have ⚡${vault}`,
          requiresTarget: false,
          disabled: true,
        });
      }
      return actions;
    }
    return [];
  }

  if (!isMyTurn && !isDefender && !isClubResponder) return [];

  if (phase === "discard") {
    return [
      {
        action: "discard_to_end_turn",
        label: "Discard this card",
        requiresTarget: false,
      },
    ];
  }

  const inDeclareBlocks = phase === "declare_blocks" && isDefender;
  const inClubResponse = phase === "respond_to_club" && isClubResponder;

  if (phase !== "main" && !inDeclareBlocks && !inClubResponse) return [];

  if (inDeclareBlocks && (card.isRoyal || card.suit === "D")) {
    return [];
  }

  if (inClubResponse && card.isRoyal) {
    return [];
  }

  const actions: ValidAction[] = [];

  if (card.isJoker) {
    if (inDeclareBlocks) {
      return [];
    }
    if (vault >= 10) {
      actions.push({
        action: "play_joker",
        label: "Destroy a Royal (−10 Vault)",
        requiresTarget: true,
        targetType: "any_royal",
      });
      actions.push({
        action: "play_joker",
        label: "Deal 10 damage to a player (−10 Vault)",
        requiresTarget: true,
        targetType: "any_player",
      });
    }
    return actions;
  }

  if (card.isRoyal) {
    if (vault >= card.vaultCost) {
      actions.push({
        action: "play_royal_to_court",
        label: `Summon to your Court (⚡${card.vaultCost})`,
        icon: "👑",
        short: "Summon",
        detail: `⚡${card.vaultCost}`,
        requiresTarget: false,
      });
    } else {
      actions.push({
        action: "play_royal_to_court",
        label: `Summoning needs ⚡${card.vaultCost} — you have ⚡${vault}`,
        icon: "👑",
        short: "Summon",
        detail: `need ⚡${card.vaultCost}`,
        requiresTarget: false,
        disabled: true,
      });
    }
    return actions;
  }

  if (card.suit === "D") {
    if (hasTakenDiamondAction) {
      actions.push({
        action: "play_diamond_to_mine",
        label: "Diamond already used this turn (one per turn)",
        icon: "💎",
        short: "Diamond",
        detail: "used this turn",
        requiresTarget: false,
        disabled: true,
      });
    } else {
      if (!inClubResponse) {
        actions.push({
          action: "play_diamond_to_mine",
          label: `Add to the Mine (+${card.pipValue} ⚡)`,
          icon: "💎",
          short: "To Mine",
          detail: `+${card.pipValue} ⚡`,
          requiresTarget: false,
        });
      } else {
        actions.push({
          action: "play_diamond_to_mine",
          label: "Add to the Mine — not during a Club response",
          icon: "💎",
          short: "To Mine",
          detail: "not right now",
          requiresTarget: false,
          disabled: true,
        });
      }
      actions.push({
        action: "discard_diamond_to_draw",
        label: "Discard → draw a card",
        icon: "🎴",
        short: "Draw",
        detail: "1 card",
        requiresTarget: false,
      });
      actions.push({
        action: "discard_diamond_for_boost",
        label: `Boost a player: +${card.pipValue} Vault this turn`,
        icon: "⚡",
        short: "Boost",
        detail: `+${card.pipValue} ⚡`,
        requiresTarget: true,
        targetType: "any_player",
      });
    }
    return actions;
  }

  if (card.suit === "H") {
    if (anyCourtHasRoyals && vault >= card.vaultCost) {
      actions.push({
        action: "attach_heart",
        label: `Attach: +${card.pipValue} health (⚡${card.vaultCost})`,
        requiresTarget: true,
        targetType: "any_royal",
      });
    } else if (anyCourtHasRoyals) {
      actions.push({
        action: "attach_heart",
        label: `Attach needs ⚡${card.vaultCost} — you have ⚡${vault}`,
        requiresTarget: false,
        disabled: true,
      });
    }
    if (vault >= card.vaultCost) {
      actions.push({
        action: "discard_heart_to_heal",
        label: `Heal a player: +${card.pipValue} life (⚡${card.vaultCost})`,
        requiresTarget: true,
        targetType: "any_player",
      });
    } else {
      actions.push({
        action: "discard_heart_to_heal",
        label: `Needs ⚡${card.vaultCost} — you have ⚡${vault}`,
        requiresTarget: false,
        disabled: true,
      });
    }
    return actions;
  }

  if (card.suit === "S") {
    if (anyCourtHasRoyals && vault >= card.vaultCost) {
      actions.push({
        action: "attach_spade",
        label: `Attach: +${card.pipValue} attack & defense (⚡${card.vaultCost})`,
        requiresTarget: true,
        targetType: "any_royal",
      });
    } else if (anyCourtHasRoyals) {
      actions.push({
        action: "attach_spade",
        label: `Attach needs ⚡${card.vaultCost} — you have ⚡${vault}`,
        requiresTarget: false,
        disabled: true,
      });
    }
    if (vault >= card.vaultCost) {
      actions.push({
        action: "discard_spade_to_return",
        label: `Reclaim from the Abyss (value ≤ ${card.pipValue}) (⚡${card.vaultCost})`,
        requiresTarget: true,
        targetType: "pick_abyss",
      });
    } else {
      actions.push({
        action: "discard_spade_to_return",
        label: `Needs ⚡${card.vaultCost} — you have ⚡${vault}`,
        requiresTarget: false,
        disabled: true,
      });
    }
    return actions;
  }

  if (card.suit === "C") {
    if (vault >= card.vaultCost) {
      actions.push({
        action: "apply_club",
        label: `Weaken a Royal: −${card.pipValue} attack & health (⚡${card.vaultCost})`,
        requiresTarget: true,
        targetType: "any_royal",
      });
      actions.push({
        action: "apply_club_damage",
        label: `Strike a player: ${card.pipValue} damage (⚡${card.vaultCost})`,
        requiresTarget: true,
        targetType: "any_player",
      });
    } else {
      actions.push({
        action: "apply_club",
        label: `Needs ⚡${card.vaultCost} — you have ⚡${vault}`,
        requiresTarget: false,
        disabled: true,
      });
    }
    return actions;
  }

  return actions;
}
