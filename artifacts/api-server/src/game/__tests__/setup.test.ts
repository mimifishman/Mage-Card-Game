import { describe, it, expect } from "vitest";
import { createInitialGameState, dealInitialHands, determineFirstPlayer } from "../setup";

describe("createInitialGameState", () => {
  it("creates valid state for 2 players", () => {
    const result = createInitialGameState("match1", ["p1", "p2"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const state = result.value;
    expect(state.deck).toHaveLength(54);
    expect(Object.keys(state.players)).toHaveLength(2);
    expect(state.players["p1"]!.life).toBe(20);
    expect(state.players["p2"]!.life).toBe(20);
  });

  it("rejects fewer than 2 players", () => {
    const result = createInitialGameState("match1", ["p1"]);
    expect(result.ok).toBe(false);
  });

  it("rejects more than 4 players", () => {
    const result = createInitialGameState("match1", ["p1", "p2", "p3", "p4", "p5"]);
    expect(result.ok).toBe(false);
  });
});

describe("dealInitialHands", () => {
  it("deals 7 cards to each player", () => {
    const init = createInitialGameState("match1", ["p1", "p2"]);
    expect(init.ok).toBe(true);
    if (!init.ok) return;
    const dealt = dealInitialHands(init.value);
    expect(dealt.ok).toBe(true);
    if (!dealt.ok) return;
    expect(dealt.value.players["p1"]!.hand).toHaveLength(7);
    expect(dealt.value.players["p2"]!.hand).toHaveLength(7);
    expect(dealt.value.deck).toHaveLength(40);
  });
});

describe("determineFirstPlayer", () => {
  it("selects a valid first player", () => {
    const init = createInitialGameState("match1", ["p1", "p2"]);
    expect(init.ok).toBe(true);
    if (!init.ok) return;
    const result = determineFirstPlayer(init.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(["p1", "p2"]).toContain(result.value.activePlayerId);
  });
});
