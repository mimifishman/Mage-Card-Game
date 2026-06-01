import { describe, it, expect } from "vitest";
import { attachHeart, attachSpade, checkAndApplyCancellation, discardHeartToHeal, discardSpadeToReturn } from "../attachments";
import { applyClub, confirmClubResponse } from "../clubs";
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
  it("heals the active player by the card pip value and spends vault", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["7H"], life: 14, vault: { tempBoost: 0, spent: 0 } }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardHeartToHeal(state, P1, "7H");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.life).toBe(21);
    expect(result.value.players[P1]!.hand).not.toContain("7H");
    expect(result.value.abyss).toContain("7H");
    expect(result.value.players[P1]!.vault.spent).toBe(7);
  });

  it("removes card from hand before adding life (no double-count)", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["3H"], life: 15, vault: { tempBoost: 0, spent: 0 } }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardHeartToHeal(state, P1, "3H");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.life).toBe(18);
    expect(result.value.players[P1]!.hand).not.toContain("3H");
    expect(result.value.abyss).toContain("3H");
  });

  it("rejects when vault < card pip value", () => {
    const state = makeState({
      mine: [],
      players: {
        [P1]: makePlayer(P1, { hand: ["7H"], vault: { tempBoost: 0, spent: 0 } }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardHeartToHeal(state, P1, "7H");
    expect(result.ok).toBe(false);
  });

  it("rejects Royal Heart card", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { hand: ["JH"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardHeartToHeal(state, P1, "JH");
    expect(result.ok).toBe(false);
  });

  it("rejects non-Heart card", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { hand: ["7S"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardHeartToHeal(state, P1, "7S");
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
    const result = discardHeartToHeal(state, P1, "5H");
    expect(result.ok).toBe(false);
  });
});

describe("discardSpadeToReturn", () => {
  it("swaps spade for abyss card of equal or lesser value and spends vault", () => {
    const state = makeState({
      mine: ["10D"],
      abyss: ["5C"],
      players: {
        [P1]: makePlayer(P1, { hand: ["7S"], vault: { tempBoost: 0, spent: 0 } }),
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
    expect(result.value.players[P1]!.vault.spent).toBe(7);
  });

  it("rejects when vault < spade pip value", () => {
    const state = makeState({
      mine: [],
      abyss: ["5C"],
      players: {
        [P1]: makePlayer(P1, { hand: ["7S"], vault: { tempBoost: 0, spent: 0 } }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardSpadeToReturn(state, P1, "7S", "5C");
    expect(result.ok).toBe(false);
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

  it("rejects Joker in abyss when spade value < 10", () => {
    const state = makeState({
      mine: ["10D"],
      abyss: ["JOKER1"],
      players: {
        [P1]: makePlayer(P1, { hand: ["9S"], vault: { tempBoost: 0, spent: 0 } }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardSpadeToReturn(state, P1, "9S", "JOKER1");
    expect(result.ok).toBe(false);
  });

  it("allows Joker in abyss to be retrieved by 10 of Spades", () => {
    const state = makeState({
      mine: ["10D"],
      abyss: ["JOKER1"],
      players: {
        [P1]: makePlayer(P1, { hand: ["10S"], vault: { tempBoost: 0, spent: 0 } }),
        [P2]: makePlayer(P2),
      },
    });
    const result = discardSpadeToReturn(state, P1, "10S", "JOKER1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.hand).toContain("JOKER1");
    expect(result.value.players[P1]!.hand).not.toContain("10S");
    expect(result.value.abyss).toContain("10S");
    expect(result.value.abyss).not.toContain("JOKER1");
  });
});

describe("spade/club pip cancellation", () => {
  it("3S + 2C + AC on same royal cancels all three cards to abyss (user scenario)", () => {
    // P1 has KH (base atk=3, hp=3). P1 attaches 3S, then P2 plays 2C + AC via confirmClubResponse.
    let state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["3S"], court: [mkRoyal("KH")], vault: { tempBoost: 0, spent: 0 } }),
        [P2]: makePlayer(P2, { hand: ["2C", "AC"] }),
      },
    });

    // Step 1: P1 attaches 3S to KH
    const r1 = attachSpade(state, P1, "3S", "KH");
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    state = r1.value;
    const royal1 = state.players[P1]!.court.find(r => r.cardId === "KH")!;
    expect(royal1.attachedCards).toContain("3S");
    expect(state.abyss).not.toContain("3S");

    // Step 2: P2 plays 2C → respond_to_club
    state = { ...state, activePlayerId: P2, phase: "main" };
    const r2 = applyClub(state, P2, "2C", P1, "KH");
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    state = r2.value;
    expect(state.phase).toBe("respond_to_club");

    // Step 3: P1 confirms — 2C applied. spade(3) ≠ club(2), no cancel yet
    const r3 = confirmClubResponse(state, P1);
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    state = r3.value;
    const royal3 = state.players[P1]!.court.find(r => r.cardId === "KH")!;
    expect(royal3).toBeDefined();
    expect(royal3.attachedCards).toContain("3S");
    expect(royal3.attachedCards).toContain("2C");
    expect(state.abyss).not.toContain("3S");

    // Step 4: P2 plays AC (pip=1) → respond_to_club
    state = { ...state, activePlayerId: P2, phase: "main" };
    const r4 = applyClub(state, P2, "AC", P1, "KH");
    expect(r4.ok).toBe(true);
    if (!r4.ok) return;
    state = r4.value;

    // Step 5: P1 confirms — AC applied. spade(3) = club(2+1=3) → CANCELLATION
    const r5 = confirmClubResponse(state, P1);
    expect(r5.ok).toBe(true);
    if (!r5.ok) return;
    state = r5.value;

    const royal5 = state.players[P1]!.court.find(r => r.cardId === "KH");
    expect(royal5).toBeDefined(); // KH still alive — base health=3 remains
    expect(royal5!.attachedCards).not.toContain("3S");
    expect(royal5!.attachedCards).not.toContain("2C");
    expect(royal5!.attachedCards).not.toContain("AC");
    expect(royal5!.attachedCards).toHaveLength(0);
    expect(state.abyss).toContain("3S");
    expect(state.abyss).toContain("2C");
    expect(state.abyss).toContain("AC");
    expect(royal5!.buffAttack).toBe(0);
    expect(royal5!.buffHealth).toBe(0);
  });

  it("cancellation triggers via attachSpade when clubs already equal the new spade total", () => {
    // KH already has 2C attached (via a prior debuff). When P1 attaches 2S, totals match → cancel.
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["2S"],
          court: [mkRoyal("KH", { buffAttack: -2, buffHealth: -2, attachedCards: ["2C"] })],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });

    const result = attachSpade(state, P1, "2S", "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const royal = result.value.players[P1]!.court.find(r => r.cardId === "KH");
    expect(royal).toBeDefined();
    expect(royal!.attachedCards).not.toContain("2S");
    expect(royal!.attachedCards).not.toContain("2C");
    expect(royal!.attachedCards).toHaveLength(0);
    expect(result.value.abyss).toContain("2S");
    expect(result.value.abyss).toContain("2C");
    expect(royal!.buffAttack).toBe(0);
    expect(royal!.buffHealth).toBe(0);
  });

  it("hearts are preserved through cancellation, heart buff remains on royal", () => {
    // KH has 4H + 2C attached. When 2S is attached, spade(2)=club(2) → cancel spade+club, heart stays.
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["2S"],
          court: [mkRoyal("KH", { buffAttack: -2, buffHealth: 2, attachedCards: ["4H", "2C"] })],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });

    const result = attachSpade(state, P1, "2S", "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const royal = result.value.players[P1]!.court.find(r => r.cardId === "KH")!;
    expect(royal.attachedCards).toContain("4H");
    expect(royal.attachedCards).not.toContain("2S");
    expect(royal.attachedCards).not.toContain("2C");
    expect(result.value.abyss).toContain("2S");
    expect(result.value.abyss).toContain("2C");
    expect(result.value.abyss).not.toContain("4H");
    expect(royal.buffAttack).toBe(0);
    expect(royal.buffHealth).toBe(4); // heart buff survives
  });

  it("multiple spades and clubs cancel when totals match", () => {
    // KH has 3S+2S attached. Then 4C+AC applied → spade(5)=club(4+1=5) → cancel all
    let state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["3S", "2S"],
          court: [mkRoyal("KH")],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, { hand: ["4C", "AC"] }),
      },
    });

    const r1 = attachSpade(state, P1, "3S", "KH");
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    state = r1.value;

    const r2 = attachSpade(state, P1, "2S", "KH");
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    state = r2.value; // buffAttack=5, attachedCards=["3S","2S"]

    // P2 plays 4C
    state = { ...state, activePlayerId: P2, phase: "main" };
    const r3 = applyClub(state, P2, "4C", P1, "KH");
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    const r4 = confirmClubResponse(r3.value, P1);
    expect(r4.ok).toBe(true);
    if (!r4.ok) return;
    state = r4.value; // spade(5) ≠ club(4), no cancel

    // P2 plays AC (pip=1) → spade(5) = club(5)
    state = { ...state, activePlayerId: P2, phase: "main" };
    const r5 = applyClub(state, P2, "AC", P1, "KH");
    expect(r5.ok).toBe(true);
    if (!r5.ok) return;
    const r6 = confirmClubResponse(r5.value, P1);
    expect(r6.ok).toBe(true);
    if (!r6.ok) return;
    state = r6.value;

    const royal = state.players[P1]!.court.find(r => r.cardId === "KH");
    expect(royal).toBeDefined();
    expect(royal!.attachedCards).toHaveLength(0);
    expect(state.abyss).toContain("3S");
    expect(state.abyss).toContain("2S");
    expect(state.abyss).toContain("4C");
    expect(state.abyss).toContain("AC");
    expect(royal!.buffAttack).toBe(0);
  });

  it("no cancellation when totals do not match (clubs exceed spades)", () => {
    // 2S attached, then 3C applied → club(3) > spade(2), no cancel
    let state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["2S"],
          court: [mkRoyal("KH")],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, { hand: ["3C"] }),
      },
    });

    const r1 = attachSpade(state, P1, "2S", "KH");
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    state = r1.value;

    // Apply 3C — KH base health=3, spade buff=2, so effectiveHealth=3+2-3=2 (survives)
    state = { ...state, activePlayerId: P2, phase: "main" };
    const r2 = applyClub(state, P2, "3C", P1, "KH");
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    const r3 = confirmClubResponse(r2.value, P1);
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    state = r3.value;

    const royal = state.players[P1]!.court.find(r => r.cardId === "KH")!;
    expect(royal.attachedCards).toContain("2S");
    expect(royal.attachedCards).toContain("3C");
    expect(state.abyss).not.toContain("2S");
    expect(state.abyss).not.toContain("3C");
  });

  it("no cancellation when only spades present (no clubs)", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["3S"], court: [mkRoyal("KH")], vault: { tempBoost: 0, spent: 0 } }),
        [P2]: makePlayer(P2),
      },
    });
    const result = attachSpade(state, P1, "3S", "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const royal = result.value.players[P1]!.court.find(r => r.cardId === "KH")!;
    expect(royal.attachedCards).toContain("3S");
    expect(result.value.abyss).not.toContain("3S");
    expect(royal.buffAttack).toBe(3);
  });

  it("subset cancellation: single matching pair within a larger spade set (one spade stays)", () => {
    // Royal has 5S and 3S attached. 5C is also attached.
    // 5S (5) cancels 5C (5) → both to Abyss. 3S has no matching club → stays.
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          court: [
            mkRoyal("KH", {
              buffAttack: 8,
              buffHealth: 8,
              attachedCards: ["5S", "3S", "5C"],
            }),
          ],
        }),
        [P2]: makePlayer(P2),
      },
    });

    const result = checkAndApplyCancellation(state, P1, "KH");
    const royal = result.players[P1]!.court.find((r) => r.cardId === "KH")!;
    expect(royal.attachedCards).toContain("3S");
    expect(royal.attachedCards).not.toContain("5S");
    expect(royal.attachedCards).not.toContain("5C");
    expect(result.abyss).toContain("5S");
    expect(result.abyss).toContain("5C");
    expect(result.abyss).not.toContain("3S");
    expect(royal.buffAttack).toBe(3);
    expect(royal.buffHealth).toBe(3);
  });

  it("subset cancellation: task example — 9S+3S+8S+10S vs 7C+10C+5C (8S stays)", () => {
    // KC (Royal) with 9S, 3S, 8S, 10S and 7C, 10C, 5C attached.
    // 10S (10) cancels 10C (10). 9S+3S (12) cancels 7C+5C (12). 8S has no match → stays.
    // buffAttack after: 8S pip = 8. buffHealth: 8.
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          court: [
            mkRoyal("KH", {
              buffAttack: 8,
              buffHealth: 8,
              attachedCards: ["9S", "3S", "8S", "10S", "7C", "10C", "5C"],
            }),
          ],
        }),
        [P2]: makePlayer(P2),
      },
    });

    const result = checkAndApplyCancellation(state, P1, "KH");
    const royal = result.players[P1]!.court.find((r) => r.cardId === "KH")!;
    expect(royal.attachedCards).toContain("8S");
    expect(royal.attachedCards).not.toContain("9S");
    expect(royal.attachedCards).not.toContain("3S");
    expect(royal.attachedCards).not.toContain("10S");
    expect(royal.attachedCards).not.toContain("7C");
    expect(royal.attachedCards).not.toContain("10C");
    expect(royal.attachedCards).not.toContain("5C");
    expect(result.abyss).toContain("9S");
    expect(result.abyss).toContain("3S");
    expect(result.abyss).toContain("10S");
    expect(result.abyss).toContain("7C");
    expect(result.abyss).toContain("10C");
    expect(result.abyss).toContain("5C");
    expect(result.abyss).not.toContain("8S");
    expect(royal.buffAttack).toBe(8);
    expect(royal.buffHealth).toBe(8);
  });

  it("no cancellation when no subset sums match (7S vs 3C+2C)", () => {
    // Spades: [7]. Clubs: [3, 2]. No subset of spades can equal 3, 2, or 5.
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          court: [
            mkRoyal("KH", {
              buffAttack: 2,
              buffHealth: 2,
              attachedCards: ["7S", "3C", "2C"],
            }),
          ],
        }),
        [P2]: makePlayer(P2),
      },
    });

    const result = checkAndApplyCancellation(state, P1, "KH");
    const royal = result.players[P1]!.court.find((r) => r.cardId === "KH")!;
    expect(royal.attachedCards).toContain("7S");
    expect(royal.attachedCards).toContain("3C");
    expect(royal.attachedCards).toContain("2C");
    expect(result.abyss).not.toContain("7S");
    expect(result.abyss).not.toContain("3C");
    expect(result.abyss).not.toContain("2C");
    expect(royal.buffAttack).toBe(2);
    expect(royal.buffHealth).toBe(2);
  });

  it("subset cancellation with Heart: Heart buff survives, cancelled spade/club go to abyss", () => {
    // Royal has 5S, 3S, 4H, 5C attached.
    // 5S (5) cancels 5C (5). 3S stays (no matching club). Heart buff preserved.
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          court: [
            mkRoyal("KH", {
              buffAttack: 3,
              buffHealth: 11,
              attachedCards: ["5S", "3S", "4H", "5C"],
            }),
          ],
        }),
        [P2]: makePlayer(P2),
      },
    });

    const result = checkAndApplyCancellation(state, P1, "KH");
    const royal = result.players[P1]!.court.find((r) => r.cardId === "KH")!;
    expect(royal.attachedCards).toContain("3S");
    expect(royal.attachedCards).toContain("4H");
    expect(royal.attachedCards).not.toContain("5S");
    expect(royal.attachedCards).not.toContain("5C");
    expect(result.abyss).toContain("5S");
    expect(result.abyss).toContain("5C");
    expect(result.abyss).not.toContain("4H");
    expect(result.abyss).not.toContain("3S");
    expect(royal.buffAttack).toBe(3);
    expect(royal.buffHealth).toBe(7);
  });

  it("cancellation via duel (clubs applied directly without respond_to_club window)", () => {
    // In duel, clubs are applied immediately without a confirmation window.
    // 3S on KH, then 2C + AC applied during duel → should cancel at the AC step.
    let state = makeState({
      phase: "duel_attacker_turn",
      mine: ["10D"],
      activePlayerId: P2,
      duelContext: {
        attackerPlayerId: P2,
        defenderPlayerId: P1,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyal("KH", { buffAttack: 3, buffHealth: 3, attachedCards: ["3S"] })],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, { hand: ["2C", "AC"], vault: { tempBoost: 0, spent: 0 } }),
      },
    });

    // P2 (attacker) plays 2C on P1's KH during duel → enters respond_to_club with returnPhase
    const r1 = applyClub(state, P2, "2C", P1, "KH");
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    state = r1.value;
    expect(state.phase).toBe("respond_to_club");
    expect(state.pendingClubDebuff?.returnPhase).toBe("duel_attacker_turn");
    // KH not yet debuffed
    expect(state.players[P1]!.court.find(r => r.cardId === "KH")!.attachedCards).not.toContain("2C");

    // P1 (defender) confirms — 2C applied. spade(3) ≠ club(2), no cancel, returns to duel
    const r2 = confirmClubResponse(state, P1);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    state = r2.value;
    expect(state.phase).toBe("duel_attacker_turn");
    const royal2 = state.players[P1]!.court.find(r => r.cardId === "KH")!;
    expect(royal2.attachedCards).toContain("3S");
    expect(royal2.attachedCards).toContain("2C");
    expect(state.abyss).not.toContain("3S");

    // P2 plays AC (pip=1) → respond_to_club again
    const r3 = applyClub(state, P2, "AC", P1, "KH");
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;
    state = r3.value;
    expect(state.phase).toBe("respond_to_club");

    // P1 confirms → spade(3)=club(2+1=3) → CANCELLATION, returns to duel
    const r4 = confirmClubResponse(state, P1);
    expect(r4.ok).toBe(true);
    if (!r4.ok) return;
    state = r4.value;
    expect(state.phase).toBe("duel_attacker_turn");

    const royal4 = state.players[P1]!.court.find(r => r.cardId === "KH");
    expect(royal4).toBeDefined(); // KH still alive — base health=3 remains
    expect(royal4!.attachedCards).toHaveLength(0);
    expect(state.abyss).toContain("3S");
    expect(state.abyss).toContain("2C");
    expect(state.abyss).toContain("AC");
    expect(royal4!.buffAttack).toBe(0);
    expect(royal4!.buffHealth).toBe(0);
  });
});

function mkRoyalLocal(cardId: string, overrides: Partial<RoyalInCourt> = {}): RoyalInCourt {
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

describe("duel attacker turn — unblocked Royal restriction", () => {
  function makeDuelAttackerState() {
    return makeState({
      mine: ["10D"],
      phase: "duel_attacker_turn",
      activePlayerId: P1,
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KS", targetPlayerId: P2, passed: true },
        { attackerPlayerId: P1, attackerCardId: "QS", targetPlayerId: P2, blockerCardIds: ["KH"] },
      ],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["6H", "5S"],
          court: [mkRoyalLocal("KS"), mkRoyalLocal("QS")],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, {
          court: [mkRoyalLocal("KH")],
        }),
      },
    });
  }

  it("rejects attachHeart on an unblocked attacking Royal", () => {
    const state = makeDuelAttackerState();
    const result = attachHeart(state, P1, "6H", "KS");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/unblocked/i);
  });

  it("rejects attachSpade on an unblocked attacking Royal", () => {
    const state = makeDuelAttackerState();
    const result = attachSpade(state, P1, "5S", "KS");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/unblocked/i);
  });

  it("allows attachHeart on a blocked attacking Royal", () => {
    const state = makeDuelAttackerState();
    const result = attachHeart(state, P1, "6H", "QS");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const royal = result.value.players[P1]!.court.find(r => r.cardId === "QS")!;
    expect(royal.buffHealth).toBe(6);
    expect(royal.attachedCards).toContain("6H");
  });

  it("allows attachSpade on a blocked attacking Royal", () => {
    const state = makeDuelAttackerState();
    const result = attachSpade(state, P1, "5S", "QS");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const royal = result.value.players[P1]!.court.find(r => r.cardId === "QS")!;
    expect(royal.buffAttack).toBe(5);
  });

  it("does NOT restrict attachHeart during duel_blocker_turn (defender is unaffected)", () => {
    const state = makeState({
      mine: ["10D"],
      phase: "duel_blocker_turn",
      activePlayerId: P2,
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KS", targetPlayerId: P2, passed: true },
      ],
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyalLocal("KS")],
        }),
        [P2]: makePlayer(P2, {
          hand: ["6H"],
          court: [mkRoyalLocal("KH")],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });
    const result = attachHeart(state, P2, "6H", "KH");
    expect(result.ok).toBe(true);
  });
});
