import { describe, it, expect } from "vitest";
import { attachHeart, attachSpade } from "../attachments";
import { playDiamondToMine, discardDiamondToDraw, discardDiamondForBoost } from "../diamonds";
import { playRoyalToCourt, attachRoyalSupport } from "../royals";
import { applyClub } from "../clubs";
import { canPlayCard } from "../validation";
import { makeState, makePlayer, P1, P2 } from "./helpers";
import type { RoyalInCourt } from "../types";

function mkRoyal(cardId: string, overrides: Partial<RoyalInCourt> = {}): RoyalInCourt {
  return {
    cardId,
    hasAttackedThisTurn: false,
    hasteLocked: false,
    damageTaken: 0,
    buffAttack: 0,
    buffHealth: 0,
    attachedCards: [],
    ...overrides,
  };
}

function declareBlocksState(defenderHand: string[] = [], defenderCourt: RoyalInCourt[] = []) {
  return makeState({
    phase: "declare_blocks",
    activePlayerId: P1,
    mine: ["10D"],
    attacks: [{ attackerPlayerId: P1, attackerCardId: "QS", targetPlayerId: P2 }],
    players: {
      [P1]: makePlayer(P1, {
        court: [mkRoyal("QS", { hasAttackedThisTurn: true })],
      }),
      [P2]: makePlayer(P2, {
        hand: defenderHand,
        court: defenderCourt,
      }),
    },
  });
}

describe("declare_blocks phase — card play permissions", () => {
  it("defender can attach a Heart to a Court Royal during declare_blocks", () => {
    const state = declareBlocksState(["5H"], [mkRoyal("KH")]);
    const result = attachHeart(state, P2, "5H", "KH");
    expect(result.ok).toBe(true);
  });

  it("defender can attach a Spade to a Court Royal during declare_blocks", () => {
    const state = declareBlocksState(["4S"], [mkRoyal("KH")]);
    const result = attachSpade(state, P2, "4S", "KH");
    expect(result.ok).toBe(true);
  });

  it("canPlayCard allows the defender during declare_blocks", () => {
    const state = declareBlocksState(["5H"]);
    const result = canPlayCard(state, P2, "5H");
    expect(result.ok).toBe(true);
  });

  it("canPlayCard rejects the attacker (active player) during declare_blocks", () => {
    const state = makeState({
      phase: "declare_blocks",
      activePlayerId: P1,
      attacks: [{ attackerPlayerId: P1, attackerCardId: "QS", targetPlayerId: P2 }],
      players: {
        [P1]: makePlayer(P1, { hand: ["5H"], court: [mkRoyal("QS", { hasAttackedThisTurn: true })] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = canPlayCard(state, P1, "5H");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/declare_blocks/i);
  });

  it("defender cannot play a Diamond to the Mine during declare_blocks", () => {
    const state = declareBlocksState(["2D"]);
    const result = playDiamondToMine(state, P2, "2D");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/declare_blocks/i);
  });

  it("defender cannot discard a Diamond to draw during declare_blocks", () => {
    const state = declareBlocksState(["2D"]);
    const result = discardDiamondToDraw(state, P2, "2D");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/declare_blocks/i);
  });

  it("defender cannot discard a Diamond for a boost during declare_blocks", () => {
    const state = declareBlocksState(["2D"]);
    const result = discardDiamondForBoost(state, P2, "2D");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/declare_blocks/i);
  });

  it("defender cannot play a Royal to Court during declare_blocks", () => {
    const state = declareBlocksState(["KH"]);
    const result = playRoyalToCourt(state, P2, "KH");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/declare_blocks/i);
  });

  it("defender cannot attach a Royal as support during declare_blocks", () => {
    const state = declareBlocksState(["JC"], [mkRoyal("KH")]);
    const result = attachRoyalSupport(state, P2, "JC", "KH");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/cannot be attached to other Royals/i);
  });

  it("defender can play a Club against an attacker's Royal during declare_blocks", () => {
    const state = makeState({
      phase: "declare_blocks",
      activePlayerId: P1,
      mine: ["10D"],
      attacks: [{ attackerPlayerId: P1, attackerCardId: "QS", targetPlayerId: P2 }],
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyal("QS", { hasAttackedThisTurn: true, buffAttack: 5, buffHealth: 5 })],
        }),
        [P2]: makePlayer(P2, { hand: ["3C"] }),
      },
    });
    const result = applyClub(state, P2, "3C", P1, "QS");
    expect(result.ok).toBe(true);
  });
});
