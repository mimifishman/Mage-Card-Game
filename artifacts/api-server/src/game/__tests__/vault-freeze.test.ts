import { describe, it, expect } from "vitest";
import { availableVault } from "../vault";
import { advanceTurn } from "../turn";
import { createInitialGameState, determineFirstPlayer, dealInitialHands } from "../setup";
import { makePlayer, makeState, P1, P2 } from "./helpers";

describe("vault freeze (per-turn snapshot)", () => {
  it("uses frozenMineTotal when set, ignoring the live Mine", () => {
    const p = makePlayer(P1, { vault: { tempBoost: 0, spent: 0, frozenMineTotal: 8 } });
    // Live mine is 15, but the frozen snapshot (8) wins.
    expect(availableVault(["10D", "5D"], p)).toBe(8);
  });

  it("falls back to the live Mine when frozenMineTotal is undefined (unchanged behavior)", () => {
    const p = makePlayer(P1); // no frozen snapshot
    expect(availableVault(["10D", "5D"], p)).toBe(15);
  });

  it("applies boost and spend on top of the frozen snapshot", () => {
    const p = makePlayer(P1, { vault: { tempBoost: 2, spent: 3, frozenMineTotal: 8 } });
    expect(availableVault(["10D"], p)).toBe(7); // 8 + 2 - 3
  });

  it("a non-active player who spent down keeps their Vault when the Mine grows", () => {
    // P2 had a turn (mine was 8), spent 7 → available 1. Now the Mine has grown
    // to 18 (another player banked Diamonds), but P2 stays at 1 until their turn.
    const p2 = makePlayer(P2, { vault: { tempBoost: 0, spent: 7, frozenMineTotal: 8 } });
    expect(availableVault(["10D", "5D", "3D"], p2)).toBe(1);
  });

  it("advanceTurn freezes the outgoing player and unfreezes the incoming one", () => {
    const state = makeState({
      mine: ["5D", "3D"], // total 8
      activePlayerId: P1,
      turnOrder: [P1, P2],
      players: {
        [P1]: makePlayer(P1, { hasHadFirstTurn: true }),
        // hasHadFirstTurn:false so advanceTurn skips the draw path (no deck needed).
        [P2]: makePlayer(P2, {
          hasHadFirstTurn: false,
          vault: { tempBoost: 0, spent: 0, frozenMineTotal: 0 },
        }),
      },
    });

    const res = advanceTurn(state);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const next = res.value;

    expect(next.activePlayerId).toBe(P2);
    // Outgoing P1 is frozen at the current Mine total (8).
    expect(next.players[P1]!.vault.frozenMineTotal).toBe(8);
    // Incoming P2 is unfrozen (tracks the live Mine again).
    expect(next.players[P2]!.vault.frozenMineTotal).toBeUndefined();

    // The active player (P2) banks a Diamond → live Mine grows to 18.
    const grownMine = [...next.mine, "10D"];
    expect(availableVault(grownMine, next.players[P2]!)).toBe(18); // active tracks live
    expect(availableVault(grownMine, next.players[P1]!)).toBe(8); // frozen holds
  });

  it("dealInitialHands freezes every non-active player at the starting Mine total (0)", () => {
    const s0 = createInitialGameState("m", [P1, P2, "p3"]);
    expect(s0.ok).toBe(true);
    if (!s0.ok) return;
    const s1 = determineFirstPlayer(s0.value);
    expect(s1.ok).toBe(true);
    if (!s1.ok) return;
    const s2 = dealInitialHands(s1.value);
    expect(s2.ok).toBe(true);
    if (!s2.ok) return;
    const st = s2.value;

    for (const id of st.turnOrder) {
      if (id === st.activePlayerId) {
        expect(st.players[id]!.vault.frozenMineTotal).toBeUndefined();
      } else {
        expect(st.players[id]!.vault.frozenMineTotal).toBe(0);
      }
    }
  });
});
