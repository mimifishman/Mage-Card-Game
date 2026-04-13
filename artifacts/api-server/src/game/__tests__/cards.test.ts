import { describe, it, expect } from "vitest";
import { getCard, fullDeck, effectiveAttack, effectiveHealth, royalSupportBuff } from "../cards";

describe("getCard", () => {
  it("returns correct card for known id", () => {
    const card = getCard("AS");
    expect(card.id).toBe("AS");
    expect(card.suit).toBe("S");
    expect(card.rank).toBe("A");
    expect(card.isRoyal).toBe(false);
    expect(card.pipValue).toBe(1);
    expect(card.vaultCost).toBe(1);
  });

  it("returns Royal card for KH", () => {
    const card = getCard("KH");
    expect(card.isRoyal).toBe(true);
    expect(card.vaultCost).toBe(3);
    expect(card.pipValue).toBe(3);
  });

  it("returns Diamond card with zero vault cost", () => {
    const card = getCard("7D");
    expect(card.suit).toBe("D");
    expect(card.vaultCost).toBe(0);
    expect(card.pipValue).toBe(7);
  });

  it("returns Joker with 10 vault cost", () => {
    const joker = getCard("JOKER1");
    expect(joker.isJoker).toBe(true);
    expect(joker.vaultCost).toBe(10);
    expect(joker.pipValue).toBe(0);
  });

  it("throws for unknown card id", () => {
    expect(() => getCard("XX")).toThrow();
  });
});

describe("fullDeck", () => {
  it("has 54 cards (52 + 2 Jokers)", () => {
    expect(fullDeck()).toHaveLength(54);
  });

  it("contains both Jokers", () => {
    const deck = fullDeck();
    expect(deck).toContain("JOKER1");
    expect(deck).toContain("JOKER2");
  });
});

describe("effectiveAttack", () => {
  it("returns base attack for Jack", () => {
    expect(effectiveAttack({ cardId: "JH", buffAttack: 0 })).toBe(1);
  });

  it("returns base attack for Queen", () => {
    expect(effectiveAttack({ cardId: "QH", buffAttack: 0 })).toBe(2);
  });

  it("includes buff", () => {
    expect(effectiveAttack({ cardId: "KS", buffAttack: 3 })).toBe(6);
  });
});

describe("effectiveHealth", () => {
  it("returns base health for Jack", () => {
    expect(effectiveHealth({ cardId: "JH", buffHealth: 0, damageTaken: 0 })).toBe(1);
  });

  it("subtracts damage taken", () => {
    expect(effectiveHealth({ cardId: "KS", buffHealth: 0, damageTaken: 2 })).toBe(1);
  });

  it("includes buff", () => {
    expect(effectiveHealth({ cardId: "QC", buffHealth: 4, damageTaken: 1 })).toBe(5);
  });
});

describe("royalSupportBuff", () => {
  it("jack gives +1/+2", () => {
    expect(royalSupportBuff("J")).toEqual({ attack: 1, health: 2 });
  });
  it("queen gives +2/+3", () => {
    expect(royalSupportBuff("Q")).toEqual({ attack: 2, health: 3 });
  });
  it("king gives +3/+4", () => {
    expect(royalSupportBuff("K")).toEqual({ attack: 3, health: 4 });
  });
});
