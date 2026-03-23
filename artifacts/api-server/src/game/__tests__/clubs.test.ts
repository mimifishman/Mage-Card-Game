import { describe, it, expect } from "vitest";
import { applyClubToRoyal } from "../clubs";
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

const richP1 = () =>
  makePlayer(P1, {
    hand: ["3C"],
    mine: ["10D"],
    vault: { base: 10, tempBoost: 0, spent: 0 },
  });

describe("applyClubToRoyal", () => {
  it("reduces target Royal's buffAttack and buffHealth", () => {
    const state = makeState({
      players: {
        [P1]: richP1(),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("KH", { buffAttack: 5, buffHealth: 5 })],
        }),
      },
    });
    const result = applyClubToRoyal(state, P1, "3C", P2, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const king = result.value.players[P2]!.court.find((r) => r.cardId === "KH")!;
    expect(king.buffAttack).toBe(2);
    expect(king.buffHealth).toBe(2);
    expect(result.value.abyss).toContain("3C");
  });

  it("destroys Royal when effective health <= 0 and sends Royal + attachments to Abyss", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          hand: ["10C"],
          mine: ["10D"],
          vault: { base: 10, tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, {
          court: [
            mkRoyal("JH", { attachedCards: ["3H", "QS"] }),
          ],
        }),
      },
    });
    const result = applyClubToRoyal(state, P1, "10C", P2, "JH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p2Court = result.value.players[P2]!.court;
    expect(p2Court.find((r) => r.cardId === "JH")).toBeUndefined();
    expect(result.value.abyss).toContain("JH");
    expect(result.value.abyss).toContain("3H");
    expect(result.value.abyss).toContain("QS");
    expect(result.value.abyss).toContain("10C");
  });

  it("rejects targeting your own Royal", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          hand: ["3C"],
          court: [mkRoyal("KH")],
          mine: ["10D"],
          vault: { base: 10, tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = applyClubToRoyal(state, P1, "3C", P1, "KH");
    expect(result.ok).toBe(false);
  });

  it("rejects if target Royal not in opponent Court", () => {
    const state = makeState({
      players: {
        [P1]: richP1(),
        [P2]: makePlayer(P2, { court: [] }),
      },
    });
    const result = applyClubToRoyal(state, P1, "3C", P2, "KH");
    expect(result.ok).toBe(false);
  });
});
