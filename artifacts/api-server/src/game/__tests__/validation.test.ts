import { describe, it, expect } from "vitest";
import { canPlayCard } from "../validation";
import { makeState, makePlayer, P1, P2 } from "./helpers";

describe("canPlayCard", () => {
  it("allows playing a card with enough vault", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["5H"],
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
      mine: [],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["10S"],
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
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["JOKER1"],
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
      mine: ["5D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["JOKER1"],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = canPlayCard(state, P1, "JOKER1");
    expect(result.ok).toBe(false);
  });

  it("allows non-royal Diamond (AD) with no vault", () => {
    const state = makeState({
      mine: [],
      players: {
        [P1]: makePlayer(P1, { hand: ["AD"], vault: { tempBoost: 0, spent: 0 } }),
        [P2]: makePlayer(P2),
      },
    });
    const result = canPlayCard(state, P1, "AD");
    expect(result.ok).toBe(true);
  });

  it("rejects Diamond Royal (JD) when vault < 1", () => {
    const state = makeState({
      mine: [],
      players: {
        [P1]: makePlayer(P1, { hand: ["JD"], vault: { tempBoost: 0, spent: 0 } }),
        [P2]: makePlayer(P2),
      },
    });
    const result = canPlayCard(state, P1, "JD");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/vault/i);
  });

  it("allows Diamond Royal (QD) when vault >= 2", () => {
    const state = makeState({
      mine: ["2D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["QD"], vault: { tempBoost: 0, spent: 0 } }),
        [P2]: makePlayer(P2),
      },
    });
    const result = canPlayCard(state, P1, "QD");
    expect(result.ok).toBe(true);
  });

  describe("respond_to_club phase — card allowlist", () => {
    function makeClubResponseState(hand: string[]) {
      return makeState({
        phase: "respond_to_club",
        mine: ["10D"],
        pendingClubDebuff: {
          attackerPlayerId: P1,
          clubCardId: "3C",
          targetPlayerId: P2,
          targetRoyalId: "KH",
        },
        players: {
          [P1]: makePlayer(P1, { hand: [], vault: { tempBoost: 0, spent: 3 } }),
          [P2]: makePlayer(P2, {
            hand,
            vault: { tempBoost: 0, spent: 0 },
          }),
        },
      });
    }

    it("allows Hearts during respond_to_club", () => {
      const state = makeClubResponseState(["5H"]);
      expect(canPlayCard(state, P2, "5H").ok).toBe(true);
    });

    it("allows Spades during respond_to_club", () => {
      const state = makeClubResponseState(["5S"]);
      expect(canPlayCard(state, P2, "5S").ok).toBe(true);
    });

    it("allows non-Royal Clubs during respond_to_club", () => {
      const state = makeClubResponseState(["5C"]);
      expect(canPlayCard(state, P2, "5C").ok).toBe(true);
    });

    it("allows Diamonds during respond_to_club", () => {
      const state = makeClubResponseState(["5D"]);
      expect(canPlayCard(state, P2, "5D").ok).toBe(true);
    });

    it("rejects Royals during respond_to_club", () => {
      const state = makeClubResponseState(["KH"]);
      const result = canPlayCard(state, P2, "KH");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/royal/i);
    });

    it("allows Jokers during respond_to_club (Rule 4)", () => {
      const state = makeClubResponseState(["JOKER1"]);
      const result = canPlayCard(state, P2, "JOKER1");
      // Rule 4: Jokers are allowed during the respond_to_club window
      expect(result.ok).toBe(true);
    });

    it("rejects the attacker from playing during respond_to_club", () => {
      const state = makeClubResponseState([]);
      const stateWithAttackerCard = {
        ...state,
        players: {
          ...state.players,
          [P1]: makePlayer(P1, { hand: ["5H"], vault: { tempBoost: 0, spent: 0 } }),
        },
      };
      const result = canPlayCard(stateWithAttackerCard, P1, "5H");
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatch(/defending player/i);
    });
  });
});
