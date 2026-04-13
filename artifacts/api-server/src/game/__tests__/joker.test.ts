import { describe, it, expect } from "vitest";
import { playJokerDestroyRoyal, playJokerDamagePlayer, playJoker } from "../joker";
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

function richState(jokerCard: string = "JOKER1", p2Overrides: Partial<ReturnType<typeof makePlayer>> = {}) {
  return makeState({
    mine: ["10D"],
    players: {
      [P1]: makePlayer(P1, {
        hand: [jokerCard],
        vault: { tempBoost: 0, spent: 0 },
      }),
      [P2]: makePlayer(P2, p2Overrides),
    },
  });
}

describe("playJokerDestroyRoyal", () => {
  it("destroys target Royal and sends it + attachments to Abyss", () => {
    const state = richState("JOKER1", {
      court: [mkRoyal("KH", { attachedCards: ["4H", "JS"] })],
    });
    const result = playJokerDestroyRoyal(state, P1, "JOKER1", P2, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.court).toHaveLength(0);
    expect(result.value.abyss).toContain("KH");
    expect(result.value.abyss).toContain("4H");
    expect(result.value.abyss).toContain("JS");
    expect(result.value.abyss).toContain("JOKER1");
    expect(result.value.players[P1]!.vault.spent).toBe(10);
  });

  it("rejects when vault < 10", () => {
    const state = makeState({
      mine: ["5D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["JOKER1"],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, { court: [mkRoyal("KH")] }),
      },
    });
    const result = playJokerDestroyRoyal(state, P1, "JOKER1", P2, "KH");
    expect(result.ok).toBe(false);
  });

  it("rejects if target Royal not in Court", () => {
    const state = richState("JOKER1", { court: [] });
    const result = playJokerDestroyRoyal(state, P1, "JOKER1", P2, "KH");
    expect(result.ok).toBe(false);
  });

  it("rejects if not a Joker card", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["10H"],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, { court: [mkRoyal("KH")] }),
      },
    });
    const result = playJokerDestroyRoyal(state, P1, "10H", P2, "KH");
    expect(result.ok).toBe(false);
  });
});

describe("playJoker (unified entry point)", () => {
  it("routes destroy_royal mode correctly", () => {
    const state = richState("JOKER1", { court: [mkRoyal("KH")] });
    const result = playJoker(state, P1, "JOKER1", "destroy_royal", P2, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.court).toHaveLength(0);
  });

  it("routes damage_player mode correctly", () => {
    const state = richState("JOKER1", { life: 20 });
    const result = playJoker(state, P1, "JOKER1", "damage_player", P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.life).toBe(10);
  });

  it("rejects destroy_royal mode without targetCardId", () => {
    const state = richState("JOKER1");
    const result = playJoker(state, P1, "JOKER1", "destroy_royal", P2);
    expect(result.ok).toBe(false);
  });
});

describe("playJokerDamagePlayer", () => {
  it("deals 10 damage to target player", () => {
    const state = richState("JOKER1", { life: 20 });
    const result = playJokerDamagePlayer(state, P1, "JOKER1", P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.life).toBe(10);
    expect(result.value.abyss).toContain("JOKER1");
    expect(result.value.players[P1]!.vault.spent).toBe(10);
  });

  it("rejects targeting yourself", () => {
    const state = richState("JOKER1");
    const result = playJokerDamagePlayer(state, P1, "JOKER1", P1);
    expect(result.ok).toBe(false);
  });
});
