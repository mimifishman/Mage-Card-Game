import { describe, it, expect } from "vitest";
import { endTurn, eliminatePlayerIfNeeded, advanceTurn, isGameOver, getWinner } from "../turn";
import { dispatchAction } from "../dispatcher";
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

describe("eliminatePlayerIfNeeded", () => {
  it("eliminates player with life <= 0", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          life: 0,
          court: [mkRoyal("KH", { attachedCards: ["3H"] })],
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = eliminatePlayerIfNeeded(state, P1);
    expect(result.players[P1]!.isEliminated).toBe(true);
    expect(result.players[P1]!.court).toHaveLength(0);
    expect(result.abyss).toContain("KH");
    expect(result.abyss).toContain("3H");
  });

  it("does not eliminate player with life > 0", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { life: 1 }),
        [P2]: makePlayer(P2),
      },
    });
    const result = eliminatePlayerIfNeeded(state, P1);
    expect(result.players[P1]!.isEliminated).toBe(false);
  });
});

describe("endTurn", () => {
  it("heals surviving Royals, resets haste lock, advances to next player", () => {
    const state = makeState({
      phase: "end_turn",
      activePlayerId: P1,
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyal("KH", { damageTaken: 2, hasteLocked: true, hasAttackedThisTurn: true })],
          hand: [],
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = endTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p1King = result.value.players[P1]!.court[0];
    expect(p1King).toBeDefined();
    expect(p1King!.damageTaken).toBe(0);
    expect(p1King!.hasteLocked).toBe(false);
    expect(p1King!.hasAttackedThisTurn).toBe(false);
    expect(result.value.activePlayerId).toBe(P2);
    expect(result.value.phase).toBe("main");
  });

  it("heals ALL surviving Royals including defender Royals", () => {
    const state = makeState({
      phase: "end_turn",
      activePlayerId: P1,
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH", { damageTaken: 3 })] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("QS", { damageTaken: 2 })] }),
      },
    });
    const result = endTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.court[0]!.damageTaken).toBe(0);
    expect(result.value.players[P2]!.court[0]!.damageTaken).toBe(0);
  });

  it("transitions to discard phase when active player has more than 7 cards", () => {
    const bigHand = ["AC", "2C", "3C", "4C", "5C", "6C", "7C", "8C", "9C", "10C"];
    const state = makeState({
      phase: "end_turn",
      players: {
        [P1]: makePlayer(P1, { hand: bigHand }),
        [P2]: makePlayer(P2),
      },
    });
    const result = endTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("discard");
    expect(result.value.players[P1]!.hand).toHaveLength(10);
    expect(result.value.abyss).toHaveLength(0);
  });

  it("advances turn in cycle", () => {
    const state = makeState({
      phase: "end_turn",
      turnOrder: [P1, P2],
      activePlayerId: P1,
      players: { [P1]: makePlayer(P1), [P2]: makePlayer(P2) },
    });
    const after1 = endTurn(state);
    expect(after1.ok && after1.value.activePlayerId).toBe(P2);
  });
});

describe("discard_to_end_turn dispatch", () => {
  it("removes the discarded card to Abyss and stays in discard phase when hand > 7", () => {
    const bigHand = ["AC", "2C", "3C", "4C", "5C", "6C", "7C", "8C", "9C"];
    const state = makeState({
      phase: "discard",
      players: {
        [P1]: makePlayer(P1, { hand: bigHand, hasHadFirstTurn: true }),
        [P2]: makePlayer(P2, { hasHadFirstTurn: true }),
      },
    });
    const result = dispatchAction(state, P1, { type: "discard_to_end_turn", cardId: "9C" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("discard");
    expect(result.value.players[P1]!.hand).toHaveLength(8);
    expect(result.value.players[P1]!.hand).not.toContain("9C");
    expect(result.value.abyss).toContain("9C");
  });

  it("auto-advances the turn when discard brings hand to exactly 7", () => {
    const hand8 = ["AC", "2C", "3C", "4C", "5C", "6C", "7C", "8C"];
    const state = makeState({
      phase: "discard",
      deck: ["KD", "QH"],
      players: {
        [P1]: makePlayer(P1, { hand: hand8, hasHadFirstTurn: true }),
        [P2]: makePlayer(P2, { hasHadFirstTurn: true }),
      },
    });
    const result = dispatchAction(state, P1, { type: "discard_to_end_turn", cardId: "8C" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.activePlayerId).toBe(P2);
    expect(result.value.abyss).toContain("8C");
  });

  it("rejects discard_to_end_turn outside of discard phase", () => {
    const state = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1, { hand: ["AC", "2C", "3C"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = dispatchAction(state, P1, { type: "discard_to_end_turn", cardId: "AC" });
    expect(result.ok).toBe(false);
  });

  it("rejects discard_to_end_turn when card is not in hand", () => {
    const state = makeState({
      phase: "discard",
      players: {
        [P1]: makePlayer(P1, { hand: ["AC", "2C", "3C", "4C", "5C", "6C", "7C", "8C"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = dispatchAction(state, P1, { type: "discard_to_end_turn", cardId: "KH" });
    expect(result.ok).toBe(false);
  });

  it("rejects normal card actions during discard phase", () => {
    const state = makeState({
      phase: "discard",
      players: {
        [P1]: makePlayer(P1, { hand: ["AC", "2C", "3C", "4C", "5C", "6C", "7C", "8C"] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = dispatchAction(state, P1, { type: "discard_to_abyss", cardId: "AC" });
    expect(result.ok).toBe(false);
  });
});

describe("advanceTurn", () => {
  it("skips eliminated players", () => {
    const P3 = "player-3";
    const state = makeState({
      phase: "end_turn",
      activePlayerId: P1,
      turnOrder: [P1, P2, P3],
      players: {
        [P1]: makePlayer(P1),
        [P2]: makePlayer(P2, { isEliminated: true }),
        [P3]: makePlayer(P3),
      },
    });
    const result = advanceTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.activePlayerId).toBe(P3);
  });

  it("does not draw a card for the next player on their first turn (hasHadFirstTurn: false)", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      players: {
        [P1]: makePlayer(P1, { hasHadFirstTurn: true }),
        [P2]: makePlayer(P2, { hasHadFirstTurn: false, hand: [] }),
      },
      deck: ["2C", "3C", "4H", "5H"],
    });
    const result = advanceTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.activePlayerId).toBe(P2);
    expect(result.value.players[P2]!.hand).toHaveLength(0);
    expect(result.value.deck).toHaveLength(4);
    expect(result.value.players[P2]!.hasHadFirstTurn).toBe(true);
  });

  it("draws a card for the next player on their second turn (hasHadFirstTurn: true)", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      players: {
        [P1]: makePlayer(P1, { hasHadFirstTurn: true }),
        [P2]: makePlayer(P2, { hasHadFirstTurn: true, hand: [] }),
      },
      deck: ["2C", "3C", "4H", "5H"],
    });
    const result = advanceTurn(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.activePlayerId).toBe(P2);
    expect(result.value.players[P2]!.hand).toHaveLength(1);
    expect(result.value.deck).toHaveLength(3);
  });

  it("no-draw applies independently to each player in a 3-player game", () => {
    const P3 = "player-3";
    const deck = ["2C", "3C", "4H", "5H", "6S", "7D"];
    const base = makeState({
      phase: "main",
      activePlayerId: P1,
      turnOrder: [P1, P2, P3],
      players: {
        [P1]: makePlayer(P1, { hasHadFirstTurn: true }),
        [P2]: makePlayer(P2, { hasHadFirstTurn: false, hand: [] }),
        [P3]: makePlayer(P3, { hasHadFirstTurn: false, hand: [] }),
      },
      deck,
    });

    const after1 = advanceTurn(base);
    expect(after1.ok).toBe(true);
    if (!after1.ok) return;
    expect(after1.value.activePlayerId).toBe(P2);
    expect(after1.value.players[P2]!.hand).toHaveLength(0);
    expect(after1.value.deck).toHaveLength(6);

    const after2 = advanceTurn(after1.value);
    expect(after2.ok).toBe(true);
    if (!after2.ok) return;
    expect(after2.value.activePlayerId).toBe(P3);
    expect(after2.value.players[P3]!.hand).toHaveLength(0);
    expect(after2.value.deck).toHaveLength(6);

    const after3 = advanceTurn(after2.value);
    expect(after3.ok).toBe(true);
    if (!after3.ok) return;
    expect(after3.value.activePlayerId).toBe(P1);
    expect(after3.value.players[P1]!.hand).toHaveLength(1);
    expect(after3.value.deck).toHaveLength(5);
  });
});

describe("isGameOver / getWinner", () => {
  it("game is not over with 2 active players", () => {
    const state = makeState({
      players: { [P1]: makePlayer(P1), [P2]: makePlayer(P2) },
    });
    expect(isGameOver(state)).toBe(false);
    expect(getWinner(state)).toBeNull();
  });

  it("game is over when one player is eliminated", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1),
        [P2]: makePlayer(P2, { isEliminated: true }),
      },
    });
    expect(isGameOver(state)).toBe(true);
    expect(getWinner(state)).toBe(P1);
  });
});
