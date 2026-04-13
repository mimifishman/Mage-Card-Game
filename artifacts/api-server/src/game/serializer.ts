import type { AttackDeclaration, CardId, GameState, PlayerState, RoyalInCourt } from "./types";
import { availableVault } from "./vault";

export interface PublicPlayerState {
  id: string;
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
}

function serializePlayer(player: PlayerState, mine: CardId[]): PublicPlayerState {
  return {
    id: player.id,
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

export function buildPlayerView(state: GameState, viewerUserId: string): PlayerGameView {
  const players: Record<string, PublicPlayerState> = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = serializePlayer(p, state.mine);
  }

  const myPlayer = state.players[viewerUserId];
  const myHand = myPlayer?.hand ?? [];

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
  };
}

export function broadcastViews(
  state: GameState,
  playerIds: string[],
  broadcastFn: (userId: string, view: PlayerGameView) => void,
): void {
  for (const userId of playerIds) {
    broadcastFn(userId, buildPlayerView(state, userId));
  }
}
