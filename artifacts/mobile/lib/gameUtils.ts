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
  if (suit === "D") return 0;
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
  | "play_joker";

export interface ValidAction {
  action: CardAction;
  label: string;
  requiresTarget: boolean;
  disabled?: boolean;
  targetType?: "own_royal" | "any_royal" | "any_player" | "any_player_inc_self" | "pick_abyss";
}

export function getValidActionsForCard(
  card: ParsedCard,
  phase: string,
  isMyTurn: boolean,
  myCourtSize: number,
  vault: number,
  hasTakenDiamondAction = false,
): ValidAction[] {
  if (!isMyTurn || phase !== "main") return [];

  const actions: ValidAction[] = [];

  if (card.isJoker) {
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
    actions.push({ action: "play_royal_to_court", label: "Play to Court", requiresTarget: false });
    if (myCourtSize > 0) {
      actions.push({
        action: "attach_royal_support",
        label: "Attach as Support to a Royal",
        requiresTarget: true,
        targetType: "own_royal",
      });
    }
    return actions;
  }

  if (card.suit === "D") {
    if (hasTakenDiamondAction) {
      actions.push({
        action: "play_diamond_to_mine",
        label: "One Diamond action per turn (already used)",
        requiresTarget: false,
        disabled: true,
      });
    } else {
      actions.push({ action: "play_diamond_to_mine", label: "Play to Mine", requiresTarget: false });
      actions.push({ action: "discard_diamond_to_draw", label: "Discard to Draw a Card", requiresTarget: false });
      actions.push({ action: "discard_diamond_for_boost", label: "Discard for +1 Vault Boost", requiresTarget: false });
    }
    return actions;
  }

  if (card.suit === "H") {
    if (myCourtSize > 0 && vault >= card.vaultCost) {
      actions.push({
        action: "attach_heart",
        label: `Attach to a Royal (+${card.pipValue} Health) [−${card.vaultCost} Vault]`,
        requiresTarget: true,
        targetType: "own_royal",
      });
    } else if (myCourtSize > 0) {
      actions.push({
        action: "attach_heart",
        label: `Need ${card.vaultCost} Vault to attach (have ${vault})`,
        requiresTarget: false,
        disabled: true,
      });
    }
    actions.push({
      action: "discard_heart_to_heal",
      label: `Discard — heal any player (+${card.pipValue} Life)`,
      requiresTarget: true,
      targetType: "any_player_inc_self",
    });
    actions.push({
      action: "discard_to_abyss",
      label: "Discard to Abyss",
      requiresTarget: false,
    });
    return actions;
  }

  if (card.suit === "S") {
    if (myCourtSize > 0 && vault >= card.vaultCost) {
      actions.push({
        action: "attach_spade",
        label: `Attach to a Royal (+${card.pipValue} Atk/Def) [−${card.vaultCost} Vault]`,
        requiresTarget: true,
        targetType: "own_royal",
      });
    } else if (myCourtSize > 0) {
      actions.push({
        action: "attach_spade",
        label: `Need ${card.vaultCost} Vault to attach (have ${vault})`,
        requiresTarget: false,
        disabled: true,
      });
    }
    actions.push({
      action: "discard_spade_to_return",
      label: `Discard — return a card from Abyss (value ≤ ${card.pipValue})`,
      requiresTarget: true,
      targetType: "pick_abyss",
    });
    actions.push({
      action: "discard_to_abyss",
      label: "Discard to Abyss",
      requiresTarget: false,
    });
    return actions;
  }

  if (card.suit === "C") {
    if (vault >= card.vaultCost) {
      actions.push({
        action: "apply_club",
        label: `Debuff opponent Royal (−${card.pipValue} ATK/HP) [−${card.vaultCost} Vault]`,
        requiresTarget: true,
        targetType: "any_royal",
      });
      actions.push({
        action: "apply_club_damage",
        label: `Deal ${card.pipValue} damage to a player [−${card.vaultCost} Vault]`,
        requiresTarget: true,
        targetType: "any_player",
      });
    } else {
      actions.push({
        action: "apply_club",
        label: `Need ${card.vaultCost} Vault (have ${vault})`,
        requiresTarget: false,
        disabled: true,
      });
    }
    return actions;
  }

  return actions;
}
