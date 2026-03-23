export type Suit = "H" | "S" | "D" | "C";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";
export type CardId = string;

export interface Card {
  id: CardId;
  suit: Suit | "JOKER";
  rank: Rank | "JOKER";
  isRoyal: boolean;
  isJoker: boolean;
  vaultCost: number;
  pipValue: number;
}

export interface RoyalInCourt {
  cardId: CardId;
  hasAttackedThisTurn: boolean;
  hasteLocked: boolean;
  damageTaken: number;
  buffAttack: number;
  buffHealth: number;
  attachedCards: CardId[];
}

export interface VaultState {
  base: number;
  tempBoost: number;
  spent: number;
}

export interface PlayerState {
  id: string;
  life: number;
  isEliminated: boolean;
  hand: CardId[];
  court: RoyalInCourt[];
  mine: CardId[];
  vault: VaultState;
}

export interface AttackDeclaration {
  attackerPlayerId: string;
  attackerCardId: CardId;
  targetPlayerId: string;
  blockerCardId?: CardId;
}

export type Zone = "deck" | "mine" | "abyss" | "hand" | "court";

export type TurnPhase =
  | "draw"
  | "main"
  | "declare_attacks"
  | "declare_blocks"
  | "resolve_combat"
  | "end_turn";

export interface GameState {
  matchId: string;
  phase: TurnPhase;
  turnNumber: number;
  activePlayerId: string;
  turnOrder: string[];
  players: Record<string, PlayerState>;
  deck: CardId[];
  abyss: CardId[];
  attacks: AttackDeclaration[];
}

export type Result<T, E extends string = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(error: string): Result<T> {
  return { ok: false, error };
}
