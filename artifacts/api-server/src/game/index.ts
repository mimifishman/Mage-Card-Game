export type {
  Card,
  CardId,
  DuelContext,
  GameState,
  PendingClubDebuff,
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

export { canPlayCard, isDuelPhase } from "./validation";

export { playDiamondToMine, discardDiamondToDraw, discardDiamondForBoost, discardToAbyss } from "./diamonds";

export { playRoyalToCourt, attachRoyalSupport } from "./royals";

export { attachHeart, attachSpade, discardHeartToHeal, discardSpadeToReturn } from "./attachments";

export { applyClub, applyClubToRoyal, confirmClubResponse } from "./clubs";

export { playJokerDestroyRoyal, playJokerDamagePlayer, playJoker } from "./joker";
export type { JokerMode } from "./joker";

export {
  declareAttack,
  confirmDeclareBlocks,
  duelPass,
  advanceDuelTurn,
  resolveCombat,
} from "./combat";

export { endTurn, endTurnCleanupAndAdvance, eliminatePlayerIfNeeded, advanceTurn, isGameOver, getWinner } from "./turn";
