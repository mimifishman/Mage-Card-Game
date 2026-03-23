import { describe, it, expect } from "vitest";
import { canPlayCard } from "../validation";
import { makeState, makePlayer, P1, P2 } from "./helpers";

describe("canPlayCard", () => {
  it("allows playing a card with enough vault", () => {
    const state = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1, {
          hand: ["5H"],
          mine: ["10D"],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = canPlayCard(state, P1, "5H");
    expect(result.ok).toBe(true);
  });

  it("rejects if not active player's turn", () => {
    const state = makeState({ activePlayerId: P2 });
    const result = canPlayCard(state, P1, "5H");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not your turn/i);
  });

  it("rejects if wrong phase", () => {
    const state = makeState({
      phase: "draw",
      players: {
        [P1]: makePlayer(P1, { hand: ["5H"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = canPlayCard(state, P1, "5H");
    expect(result.ok).toBe(false);
  });

  it("rejects if card not in hand", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { hand: [] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = canPlayCard(state, P1, "5H");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not in your hand/i);
  });

  it("rejects if not enough vault", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          hand: ["10S"],
          mine: [],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = canPlayCard(state, P1, "10S");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/vault/i);
  });

  it("allows Joker when vault >= 10", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          hand: ["JOKER1"],
          mine: ["10D"],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = canPlayCard(state, P1, "JOKER1");
    expect(result.ok).toBe(true);
  });

  it("rejects Joker when vault < 10", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          hand: ["JOKER1"],
          mine: ["5D"],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = canPlayCard(state, P1, "JOKER1");
    expect(result.ok).toBe(false);
  });
});
