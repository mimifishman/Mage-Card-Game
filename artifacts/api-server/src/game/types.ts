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
  tempBoost: number;
  spent: number;
}

export interface PlayerState {
  id: string;
  life: number;
  isEliminated: boolean;
  hand: CardId[];
  court: RoyalInCourt[];
  vault: VaultState;
  hasPlayedDiamondThisTurn: boolean;
  hasHadFirstTurn: boolean;
}

export interface AttackDeclaration {
  attackerPlayerId: string;
  attackerCardId: CardId;
  targetPlayerId: string;
  blockerCardIds?: CardId[];
  blockerDamageOrder?: CardId[];
  passed?: boolean;
}

export interface PendingClubDebuff {
  attackerPlayerId: string;
  clubCardId: CardId;
  targetPlayerId: string;
  targetRoyalId: CardId;
  defenderDiamondUsed?: boolean;
  returnPhase?: TurnPhase;
}

export interface DuelContext {
  attackerPlayerId: string;
  defenderPlayerId: string;
  duelAttackerPassed: boolean;
  duelBlockerPassed: boolean;
  attackerDiamondUsed: boolean;
  defenderDiamondUsed: boolean;
}

export interface CombatPairOutcome {
  attackerCardId: CardId;
  blockerCardIds: CardId[];
  attackerDestroyed: boolean;
  blockerDestroyed: boolean;
  directDamage: number;
  targetPlayerId: string;
}

export interface CombatSummary {
  pairs: CombatPairOutcome[];
}

export type Zone = "deck" | "mine" | "abyss" | "hand" | "court";

export type TurnPhase =
  | "draw"
  | "main"
  | "declare_attacks"
  | "declare_blocks"
  | "assign_damage_order"
  | "duel_attacker_turn"
  | "duel_blocker_turn"
  | "resolve_combat"
  | "end_turn"
  | "discard"
  | "respond_to_club";

export interface GameState {
  matchId: string;
  phase: TurnPhase;
  turnNumber: number;
  activePlayerId: string;
  turnOrder: string[];
  players: Record<string, PlayerState>;
  deck: CardId[];
  mine: CardId[];
  abyss: CardId[];
  attacks: AttackDeclaration[];
  hasAttackedThisTurn: boolean;
  duelContext?: DuelContext;
  lastCombatSummary?: CombatSummary;
  pendingClubDebuff?: PendingClubDebuff;
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
