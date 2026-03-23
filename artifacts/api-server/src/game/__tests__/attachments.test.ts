import { describe, it, expect } from "vitest";
import { attachHeart, attachSpade } from "../attachments";
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

describe("attachHeart", () => {
  it("adds health to target Royal", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          hand: ["6H"],
          court: [mkRoyal("KS")],
          mine: ["10D"],
          vault: { base: 10, tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = attachHeart(state, P1, "6H", "KS");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const king = result.value.players[P1]!.court.find((r) => r.cardId === "KS")!;
    expect(king.buffHealth).toBe(6);
    expect(king.attachedCards).toContain("6H");
    expect(result.value.players[P1]!.hand).not.toContain("6H");
    expect(result.value.players[P1]!.vault.spent).toBe(6);
  });

  it("rejects Royal Heart (J/Q/K of Hearts)", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          hand: ["JH"],
          court: [mkRoyal("KS")],
          mine: [],
          vault: { base: 0, tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = attachHeart(state, P1, "JH", "KS");
    expect(result.ok).toBe(false);
  });

  it("rejects non-Heart card", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          hand: ["6S"],
          court: [mkRoyal("KS")],
          mine: ["10D"],
          vault: { base: 10, tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = attachHeart(state, P1, "6S", "KS");
    expect(result.ok).toBe(false);
  });

  it("rejects if target Royal not in Court", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          hand: ["6H"],
          court: [],
          mine: ["10D"],
          vault: { base: 10, tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = attachHeart(state, P1, "6H", "KS");
    expect(result.ok).toBe(false);
  });
});

describe("attachSpade", () => {
  it("adds attack AND health to target Royal", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          hand: ["4S"],
          court: [mkRoyal("QH")],
          mine: ["10D"],
          vault: { base: 10, tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = attachSpade(state, P1, "4S", "QH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const queen = result.value.players[P1]!.court.find((r) => r.cardId === "QH")!;
    expect(queen.buffAttack).toBe(4);
    expect(queen.buffHealth).toBe(4);
    expect(queen.attachedCards).toContain("4S");
    expect(result.value.players[P1]!.vault.spent).toBe(4);
  });
});
