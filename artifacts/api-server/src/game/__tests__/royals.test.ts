import { describe, it, expect } from "vitest";
import { playRoyalToCourt, attachRoyalSupport } from "../royals";
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

describe("playRoyalToCourt", () => {
  it("places Royal in Court with haste lock", () => {
    const state = makeState({
      mine: ["3D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["KH"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = playRoyalToCourt(state, P1, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const court = result.value.players[P1]!.court;
    expect(court).toHaveLength(1);
    expect(court[0]!.cardId).toBe("KH");
    expect(court[0]!.hasteLocked).toBe(true);
    expect(result.value.players[P1]!.hand).not.toContain("KH");
  });

  it("rejects playing non-Royal", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { hand: ["5H"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = playRoyalToCourt(state, P1, "5H");
    expect(result.ok).toBe(false);
  });

  it("rejects playing a Royal to Court during declare_blocks", () => {
    const state = makeState({
      phase: "declare_blocks",
      mine: ["3D"],
      attacks: [{ attackerPlayerId: P1, attackerCardId: "QS", targetPlayerId: P2 }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("QS", { hasAttackedThisTurn: true })] }),
        [P2]: makePlayer(P2, { hand: ["KH"] }),
      },
    });
    const result = playRoyalToCourt(state, P2, "KH");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/declare_blocks/i);
  });
});

describe("attachRoyalSupport", () => {
  it("always rejects — Royals cannot be attached to other Royals", () => {
    const state = makeState({
      mine: ["AD"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["JC"],
          court: [mkRoyal("KH")],
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = attachRoyalSupport(state, P1, "JC", "KH");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/cannot be attached to other Royals/i);
  });

  it("rejects even when the support Royal was an attacker", () => {
    const state = makeState({
      phase: "declare_attacks",
      mine: ["AD"],
      attacks: [{ attackerPlayerId: P1, attackerCardId: "JC", targetPlayerId: P2 }],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["JC"],
          court: [mkRoyal("KH"), mkRoyal("JC", { hasAttackedThisTurn: true })],
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = attachRoyalSupport(state, P1, "JC", "KH");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/cannot be attached to other Royals/i);
  });

  it("rejects if target Royal not in Court", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { hand: ["JC"], court: [] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = attachRoyalSupport(state, P1, "JC", "KH");
    expect(result.ok).toBe(false);
  });
});
