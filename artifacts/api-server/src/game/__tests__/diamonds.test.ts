import { describe, it, expect } from "vitest";
import { playDiamondToMine, discardDiamondToDraw, discardDiamondForBoost } from "../diamonds";
import { calculateVaultFromMine } from "../vault";
import { makeState, makePlayer, P1, P2 } from "./helpers";

function stateWithHand(hand: string[], mine: string[] = [], deck: string[] = []) {
  return makeState({
    players: {
      [P1]: makePlayer(P1, { hand, mine, vault: { tempBoost: 0, spent: 0 } }),
      [P2]: makePlayer(P2),
    },
    deck,
  });
}

describe("playDiamondToMine", () => {
  it("moves Diamond from hand to mine", () => {
    const state = stateWithHand(["7D"]);
    const result = playDiamondToMine(state, P1, "7D");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.mine).toContain("7D");
    expect(result.value.players[P1]!.hand).not.toContain("7D");
    expect(calculateVaultFromMine(result.value.players[P1]!.mine)).toBe(7);
  });

  it("rejects non-Diamond cards", () => {
    const state = stateWithHand(["7H"]);
    const result = playDiamondToMine(state, P1, "7H");
    expect(result.ok).toBe(false);
  });

  it("rejects Royal Diamonds (J/Q/K)", () => {
    const state = stateWithHand(["JD"]);
    const result = playDiamondToMine(state, P1, "JD");
    expect(result.ok).toBe(false);
  });
});

describe("discardDiamondToDraw", () => {
  it("discards Diamond and draws a card", () => {
    const state = stateWithHand(["5D"], [], ["KH", "2C"]);
    const result = discardDiamondToDraw(state, P1, "5D");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.hand).not.toContain("5D");
    expect(result.value.players[P1]!.hand).toContain("KH");
    expect(result.value.abyss).toContain("5D");
    expect(result.value.deck).toEqual(["2C"]);
  });

  it("rejects non-Diamond", () => {
    const state = stateWithHand(["5H"], [], ["AC"]);
    const result = discardDiamondToDraw(state, P1, "5H");
    expect(result.ok).toBe(false);
  });
});

describe("discardDiamondForBoost", () => {
  it("discards Diamond and boosts vault", () => {
    const state = stateWithHand(["8D"]);
    const result = discardDiamondForBoost(state, P1, "8D");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.hand).not.toContain("8D");
    expect(result.value.players[P1]!.vault.tempBoost).toBe(8);
    expect(result.value.abyss).toContain("8D");
  });
});
