import { describe, it, expect } from "vitest";
import { drawCard, drawCards } from "../draw";
import { makeState, makePlayer, P1, P2 } from "./helpers";

describe("drawCard", () => {
  it("draws top card to player hand", () => {
    const state = makeState({
      deck: ["AC", "2C", "3C"],
      players: { [P1]: makePlayer(P1), [P2]: makePlayer(P2) },
    });
    const result = drawCard(state, P1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.hand).toContain("AC");
    expect(result.value.deck).toEqual(["2C", "3C"]);
  });

  it("reshuffles Abyss into deck when deck is empty", () => {
    const state = makeState({
      deck: [],
      abyss: ["7H", "8H", "9H"],
      players: { [P1]: makePlayer(P1), [P2]: makePlayer(P2) },
    });
    const result = drawCard(state, P1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.hand).toHaveLength(1);
    expect(result.value.abyss).toHaveLength(0);
    expect(result.value.deck.length + result.value.players[P1]!.hand.length).toBe(3);
  });

  it("returns error when both deck and abyss are empty", () => {
    const state = makeState({ deck: [], abyss: [] });
    const result = drawCard(state, P1);
    expect(result.ok).toBe(false);
  });

  it("returns error for unknown player", () => {
    const state = makeState({ deck: ["AC"] });
    const result = drawCard(state, "unknown");
    expect(result.ok).toBe(false);
  });
});

describe("drawCards", () => {
  it("draws multiple cards", () => {
    const state = makeState({
      deck: ["AC", "2C", "3C", "4C", "5C"],
      players: { [P1]: makePlayer(P1), [P2]: makePlayer(P2) },
    });
    const result = drawCards(state, P1, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.hand).toHaveLength(3);
    expect(result.value.deck).toHaveLength(2);
  });
});
