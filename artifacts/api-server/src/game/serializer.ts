import type { AttackDeclaration, CardId, CombatSummary, DirectHit, DuelContext, EliminationEvent, GameState, InterruptStackState, LifeEvent, PendingClubDebuff, PlayerState, RoyalInCourt } from "./types";
import { availableVault } from "./vault";

export interface PublicPlayerState {
  id: string;
  displayName: string;
  life: number;
  isEliminated: boolean;
  court: RoyalInCourt[];
  handCount: number;
  vault: {
    available: number;
    tempBoost: number;
    spent: number;
  };
}

export interface PlayerGameView {
  matchId: string;
  phase: string;
  turnNumber: number;
  activePlayerId: string;
  turnOrder: string[];
  players: Record<string, PublicPlayerState>;
  myHand: string[];
  myDiamondPlayed: boolean;
  deck: number;
  mine: string[];
  abyss: string[];
  attacks: AttackDeclaration[];
  hasAttackedThisTurn: boolean;
  duelContext?: DuelContext;
  lastCombatSummary?: CombatSummary;
  lastDirectHit?: DirectHit;
  lastEliminations?: EliminationEvent[];
  /** Rolling feed of life-total changes with amounts + resulting life. */
  lifeEvents?: LifeEvent[];
  pendingClubDebuff?: PendingClubDebuff;
  pendingBlockDefenders?: string[];
  duelQueue?: string[];
  interruptStack?: InterruptStackState;
  /** Debug/testing aid: full hands of AI seats, revealed to every viewer. */
  revealedHands?: Record<string, CardId[]>;
}

function serializePlayer(player: PlayerState, mine: CardId[]): PublicPlayerState {
  return {
    id: player.id,
    displayName: player.displayName || `Player ${player.id.slice(0, 6)}`,
    life: player.life,
    isEliminated: player.isEliminated,
    court: player.court,
    handCount: player.hand.length,
    vault: {
      available: availableVault(mine, player),
      tempBoost: player.vault.tempBoost,
      spent: player.vault.spent,
    },
  };
}

export function buildPlayerView(
  state: GameState,
  viewerUserId: string,
  revealHandsFor?: string[],
): PlayerGameView {
  const players: Record<string, PublicPlayerState> = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = serializePlayer(p, state.mine);
  }

  const myPlayer = state.players[viewerUserId];
  const myHand = myPlayer?.hand ?? [];

  // Debug/testing aid: expose the listed players' (AI seats') full hands.
  let revealedHands: Record<string, CardId[]> | undefined;
  if (revealHandsFor?.length) {
    revealedHands = {};
    for (const id of revealHandsFor) {
      const p = state.players[id];
      if (p) revealedHands[id] = p.hand;
    }
  }

  return {
    matchId: state.matchId,
    phase: state.phase,
    turnNumber: state.turnNumber,
    activePlayerId: state.activePlayerId,
    turnOrder: state.turnOrder,
    players,
    myHand,
    myDiamondPlayed: myPlayer?.hasPlayedDiamondThisTurn ?? false,
    deck: state.deck.length,
    mine: state.mine,
    abyss: state.abyss,
    attacks: state.attacks,
    hasAttackedThisTurn: state.hasAttackedThisTurn,
    duelContext: state.duelContext,
    lastCombatSummary: state.lastCombatSummary,
    lastDirectHit: state.lastDirectHit,
    lastEliminations: state.lastEliminations,
    lifeEvents: state.lifeEvents,
    pendingClubDebuff: state.pendingClubDebuff,
    pendingBlockDefenders: state.pendingBlockDefenders,
    duelQueue: state.duelQueue,
    interruptStack: state.interruptStack,
    revealedHands,
  };
}

export function broadcastViews(
  state: GameState,
  playerIds: string[],
  broadcastFn: (userId: string, view: PlayerGameView) => void,
  revealHandsFor?: string[],
): void {
  for (const userId of playerIds) {
    broadcastFn(userId, buildPlayerView(state, userId, revealHandsFor));
  }
}
