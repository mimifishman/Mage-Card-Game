import { describe, it, expect } from "vitest";
import { attachHeart, attachSpade, discardHeartToHeal, discardSpadeToReturn } from "../attachments";
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
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["6H"],
          court: [mkRoyal("KS")],
          vault: { tempBoost: 0, spent: 0 },
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
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = attachHeart(state, P1, "JH", "KS");
    expect(result.ok).toBe(false);
  });

  it("rejects non-Heart card", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["6S"],
          court: [mkRoyal("KS")],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = attachHeart(state, P1, "6S", "KS");
    expect(result.ok).toBe(false);
  });

  it("rejects if target Royal not in Court", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["6H"],
          court: [],
          vault: { tempBoost: 0, spent: 0 },
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
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["4S"],
          court: [mkRoyal("QH")],
          vault: { tempBoost: 0, spent: 0 },
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

describe("discardHeartToHeal", () => {
  it("heals target opponent by the card pip value", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { hand: ["7H"] }),
        [P2]: makePlayer(P2, { life: 14 }),
      },
    });
    const result = discardHeartToHeal(state, P1, "7H", P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.life).toBe(21);
    expect(result.value.players[P1]!.hand).not.toContain("7H");
    expect(result.value.abyss).toContain("7H");
    expect(result.value.players[P1]!.vault.spent).toBe(0);
  });

  it("heals self when targetPlayerId === playerId", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { hand: ["3H"], life: 15 }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardHeartToHeal(state, P1, "3H", P1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.life).toBe(18);
    expect(result.value.players[P1]!.hand).not.toContain("3H");
    expect(result.value.abyss).toContain("3H");
  });

  it("rejects Royal Heart card", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { hand: ["JH"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardHeartToHeal(state, P1, "JH", P2);
    expect(result.ok).toBe(false);
  });

  it("rejects non-Heart card", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { hand: ["7S"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardHeartToHeal(state, P1, "7S", P2);
    expect(result.ok).toBe(false);
  });

  it("rejects healing eliminated player", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { hand: ["4H"] }),
        [P2]: makePlayer(P2, { isEliminated: true }),
      },
    });
    const result = discardHeartToHeal(state, P1, "4H", P2);
    expect(result.ok).toBe(false);
  });

  it("rejects when not active player", () => {
    const state = makeState({
      activePlayerId: P2,
      players: {
        [P1]: makePlayer(P1, { hand: ["5H"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardHeartToHeal(state, P1, "5H", P2);
    expect(result.ok).toBe(false);
  });
});

describe("discardSpadeToReturn", () => {
  it("swaps spade for abyss card of equal or lesser value", () => {
    const state = makeState({
      abyss: ["5C"],
      players: {
        [P1]: makePlayer(P1, { hand: ["7S"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardSpadeToReturn(state, P1, "7S", "5C");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.hand).toContain("5C");
    expect(result.value.players[P1]!.hand).not.toContain("7S");
    expect(result.value.abyss).toContain("7S");
    expect(result.value.abyss).not.toContain("5C");
  });

  it("rejects when abyss card value exceeds spade value", () => {
    const state = makeState({
      abyss: ["9H"],
      players: {
        [P1]: makePlayer(P1, { hand: ["6S"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardSpadeToReturn(state, P1, "6S", "9H");
    expect(result.ok).toBe(false);
  });

  it("rejects when target card is not in abyss", () => {
    const state = makeState({
      abyss: [],
      players: {
        [P1]: makePlayer(P1, { hand: ["8S"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardSpadeToReturn(state, P1, "8S", "3C");
    expect(result.ok).toBe(false);
  });

  it("rejects Royal Spade card", () => {
    const state = makeState({
      abyss: ["2H"],
      players: {
        [P1]: makePlayer(P1, { hand: ["JS"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardSpadeToReturn(state, P1, "JS", "2H");
    expect(result.ok).toBe(false);
  });

  it("rejects when not active player", () => {
    const state = makeState({
      activePlayerId: P2,
      abyss: ["4D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["9S"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardSpadeToReturn(state, P1, "9S", "4D");
    expect(result.ok).toBe(false);
  });
});
