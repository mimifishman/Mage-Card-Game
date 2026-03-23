export type {
  Card,
  CardId,
  GameState,
  PlayerState,
  Rank,
  Result,
  RoyalInCourt,
  Suit,
  TurnPhase,
  VaultState,
  AttackDeclaration,
  Zone,
} from "./types";
export { ok, err } from "./types";

export {
  getCard,
  fullDeck,
  shuffle,
  royalBaseAttack,
  royalBaseHealth,
  royalSupportBuff,
  effectiveAttack,
  effectiveHealth,
} from "./cards";

export { calculateVaultFromMine, availableVault } from "./vault";

export { drawCard, drawCards } from "./draw";

export { createInitialGameState, dealInitialHands, determineFirstPlayer } from "./setup";

export { canPlayCard } from "./validation";

export { playDiamondToMine, discardDiamondToDraw, discardDiamondForBoost } from "./diamonds";

export { playRoyalToCourt, attachRoyalSupport } from "./royals";

export { attachHeart, attachSpade } from "./attachments";

export { applyClubToRoyal } from "./clubs";

export { playJokerDestroyRoyal, playJokerDamagePlayer, playJoker } from "./joker";
export type { JokerMode } from "./joker";

export { beginDeclareBlocks, declareAttack, declareBlock, resolveCombat } from "./combat";

export { endTurn, eliminatePlayerIfNeeded, advanceTurn, isGameOver, getWinner } from "./turn";
