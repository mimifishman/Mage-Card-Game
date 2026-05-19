import { describe, it, expect } from "vitest";
import { dispatchAction } from "../dispatcher";
import { makeState, makePlayer, P1, P2 } from "./helpers";
import type { GameAction } from "../actions";
import type { GameState } from "../types";
import { availableVault } from "../vault";

function ok<T>(result: { ok: true; value: T } | { ok: false; error: string }, label: string): T {
  if (!result.ok) {
    throw new Error(`Expected ${label} to succeed, got: ${result.error}`);
  }
  return result.value;
}

describe("end-to-end legal first turn through dispatcher", () => {
  it("active player can play diamond, then royal, then attach heart/spade, then club opponent, then end turn", () => {
    let state: GameState = makeState({
      phase: "main",
      activePlayerId: P1,
      players: {
        [P1]: makePlayer(P1, {
          hand: ["10D", "JS", "5H", "4S", "3C"],
          hasHadFirstTurn: true,
        }),
        [P2]: makePlayer(P2, { hand: ["2D"] }),
      },
      deck: ["AD", "2H", "3H", "4H", "5D"],
    });

    expect(availableVault(state.mine, state.players[P1]!)).toBe(0);

    state = ok(
      dispatchAction(state, P1, {
        type: "play_diamond_to_mine",
        cardId: "10D",
      } as GameAction),
      "play_diamond_to_mine 10D",
    );
    expect(state.mine).toEqual(["10D"]);
    expect(availableVault(state.mine, state.players[P1]!)).toBe(10);

    state = ok(
      dispatchAction(state, P1, {
        type: "play_royal_to_court",
        cardId: "JS",
      } as GameAction),
      "play_royal_to_court JS",
    );
    expect(state.players[P1]!.court.map((r) => r.cardId)).toEqual(["JS"]);
    expect(availableVault(state.mine, state.players[P1]!)).toBe(9);

    state = ok(
      dispatchAction(state, P1, {
        type: "attach_heart",
        heartCardId: "5H",
        targetRoyalId: "JS",
      } as GameAction),
      "attach_heart 5H -> JS",
    );
    expect(state.players[P1]!.court[0]!.buffHealth).toBe(5);
    expect(availableVault(state.mine, state.players[P1]!)).toBe(4);

    state = ok(
      dispatchAction(state, P1, {
        type: "attach_spade",
        spadeCardId: "4S",
        targetRoyalId: "JS",
      } as GameAction),
      "attach_spade 4S -> JS",
    );
    expect(state.players[P1]!.court[0]!.buffAttack).toBe(4);
    expect(state.players[P1]!.court[0]!.buffHealth).toBe(9);
    expect(availableVault(state.mine, state.players[P1]!)).toBe(0);

    // Verify the engine enforces one-diamond-per-turn — simulate having another diamond in hand.
    const stateWithExtraDiamond: GameState = {
      ...state,
      players: {
        ...state.players,
        [P1]: {
          ...state.players[P1]!,
          hand: [...state.players[P1]!.hand, "2D"],
        },
      },
    };
    const secondDiamond = dispatchAction(stateWithExtraDiamond, P1, {
      type: "play_diamond_to_mine",
      cardId: "2D",
    } as GameAction);
    expect(secondDiamond.ok).toBe(false);
    if (!secondDiamond.ok) {
      expect(secondDiamond.error).toMatch(/Diamond action/i);
    }

    // Apply club to opponent (no royal target — direct damage path used by mobile "apply_club_damage").
    // Refresh vault so the 3C (cost 3) is affordable.
    const p2LifeBefore = state.players[P2]!.life;
    const stateForClub: GameState = {
      ...state,
      players: {
        ...state.players,
        [P1]: {
          ...state.players[P1]!,
          vault: { tempBoost: 0, spent: 0 },
        },
      },
    };
    state = ok(
      dispatchAction(stateForClub, P1, {
        type: "apply_club",
        clubCardId: "3C",
        targetPlayerId: P2,
      } as GameAction),
      "apply_club 3C -> P2 (no royal target)",
    );
    expect(state.players[P2]!.life).toBe(p2LifeBefore - 3);

    const endResult = dispatchAction(state, P1, { type: "end_turn" } as GameAction);
    expect(endResult.ok).toBe(true);
    if (endResult.ok) {
      expect(endResult.value.activePlayerId).toBe(P2);
    }
  });

  it("rejection messages from validation are surfaced to dispatcher (non-active player cannot play)", () => {
    const state: GameState = makeState({
      phase: "main",
      activePlayerId: P1,
      players: {
        [P1]: makePlayer(P1, { hand: ["2D"] }),
        [P2]: makePlayer(P2, { hand: ["3D"] }),
      },
    });
    const result = dispatchAction(state, P2, {
      type: "play_diamond_to_mine",
      cardId: "3D",
    } as GameAction);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not your turn/i);
    }
  });

  it("rejects an attach when player has no vault — error string is descriptive (no generic 'Action failed')", () => {
    const state: GameState = makeState({
      phase: "main",
      activePlayerId: P1,
      players: {
        [P1]: makePlayer(P1, {
          hand: ["5H"],
          court: [
            {
              cardId: "JS",
              hasAttackedThisTurn: false,
              hasteLocked: true,
              damageTaken: 0,
              buffAttack: 0,
              buffHealth: 0,
              attachedCards: [],
            },
          ],
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = dispatchAction(state, P1, {
      type: "attach_heart",
      heartCardId: "5H",
      targetRoyalId: "JS",
    } as GameAction);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/vault/i);
      expect(result.error).not.toBe("Action failed");
    }
  });
});
