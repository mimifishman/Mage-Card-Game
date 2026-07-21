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
  /**
   * Snapshot of the Mine's total taken when this player's turn last ended.
   * While it is set, the player's available Vault is frozen at this value
   * (plus/minus their own boosts and spends) so that other players adding to
   * the shared Mine does NOT raise their Vault until their own next turn.
   * The ACTIVE player leaves this undefined and uses the live Mine total, so
   * Diamonds they bank this turn benefit them immediately. It is cleared when
   * a player's turn begins (resetVaultForTurn) and re-set when their turn ends
   * (advanceTurn).
   */
  frozenMineTotal?: number;
}

export interface PlayerState {
  id: string;
  displayName: string;
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
  resolvedPairAttackerIds?: CardId[];
  autoPassedPlayerIds?: string[];
  preResolvedUnblockedAttackerIds?: CardId[];
  immediateHits?: CombatPairOutcome[];
  /** Set once a duel_* phase state has actually been returned to clients for this duel. Absent = the duel is (so far) invisible to players. */
  duelPhaseShown?: boolean;
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
  autoPassedPlayerIds?: string[];
  immediateHits?: CombatPairOutcome[];
  /** True when blocked pairs resolved without any duel phase ever being shown to clients (both sides auto-passed instantly). */
  autoResolved?: boolean;
}

/**
 * Attribution record for direct (non-combat) damage — a Club burned for face
 * damage or a Joker's 10-damage mode. Combat damage is already attributable
 * client-side via lastCombatSummary/duelContext, but these plays only show up
 * as a life delta, so clients need the source card to pick the right visual
 * effect. `seq` increases monotonically per match so clients can detect a new
 * hit without phase-transition gating (and even when the same card/target
 * repeats).
 */
export interface DirectHit {
  sourceCardId: CardId;
  targetPlayerId: string;
  amount: number;
  seq: number;
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
  | "respond_to_club"
  | "interrupt_window";

/**
 * A single card play that has been placed on the LIFO interrupt stack,
 * waiting to resolve. `action` is a raw GameAction (imported as `unknown`
 * here to avoid a circular import between types.ts and actions.ts; the
 * interrupt engine in dispatcher.ts narrows it back to GameAction).
 */
export interface InterruptEntry {
  playerId: string;
  action: unknown;
}

export interface InterruptStackState {
  /** LIFO stack of pending interrupts; the last element is the top (resolves first). */
  entries: InterruptEntry[];
  /** The phase to restore once the stack is fully drained. */
  returnPhase: TurnPhase;
  /** Player who currently has priority to add another interrupt or pass. */
  priorityPlayerId: string;
  /** Players who have passed priority in a row since the last push/resolve. */
  passedPlayerIds: string[];
}

export interface AttackTargetGroup {
  targetPlayerId: string;
  royalCardIds: CardId[];
}

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
  /** Last direct (non-combat) damage event, for client hit-effect attribution. */
  lastDirectHit?: DirectHit;
  pendingClubDebuff?: PendingClubDebuff;
  /** Targeted opponents who still need to submit (or pass on) blocks during "declare_blocks". Cleared once all have submitted. */
  pendingBlockDefenders?: string[];
  /** Ordered queue of remaining opponent IDs (with blocked pairs) still waiting to have their fight resolved, after the one currently in duelContext. */
  duelQueue?: string[];
  /** Accumulates resolved combat pairs across every opponent fought this combat, so the final lastCombatSummary covers all of them. */
  combatPairsAccumulator?: CombatPairOutcome[];
  /** Accumulates auto-passed player IDs across every opponent fought this combat. */
  combatAutoPassedAccum?: string[];
  /** True once any duel phase in this combat has been shown to clients (across the whole duel queue). */
  combatDuelShownAccum?: boolean;
  interruptStack?: InterruptStackState;
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
