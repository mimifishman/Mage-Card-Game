import { describe, it, expect } from "vitest";
import {
  diffHitEffects,
  toPrevSlice,
  MAX_EFFECTS_PER_TARGET,
  type HitEffectsView,
} from "@/lib/hitEffectsDiff";

// A minimal snapshot builder. Cards use the game's rank+suit ids: "JC" (Jack
// of Clubs), "QD", "5H", etc. Royals live in each player's court.
function view(partial: Partial<HitEffectsView> & { players?: HitEffectsView["players"] }): HitEffectsView {
  return {
    phase: "main",
    turnNumber: 1,
    players: {},
    ...partial,
  };
}

function player(life: number, court: { cardId: string; attachedCards?: string[] }[] = []) {
  return {
    life,
    court: court.map((r) => ({ cardId: r.cardId, attachedCards: r.attachedCards ?? [] })),
  };
}

// Diff helper: seed prev from `before`, then diff `after` against it.
function diff(before: HitEffectsView, after: HitEffectsView, batchSeq = 0) {
  return diffHitEffects(toPrevSlice(before), after, batchSeq);
}

describe("diffHitEffects", () => {
  it("returns [] for the very first snapshot (no prev)", () => {
    expect(diffHitEffects(null, view({ players: { a: player(20) } }), 0)).toEqual([]);
  });

  it("returns [] for a repeated identical snapshot", () => {
    const v = view({ players: { a: player(20), b: player(20) } });
    expect(diff(v, v)).toEqual([]);
  });

  it("fires an unblocked combat hit once, attributed by the attacker's suit", () => {
    const before = view({
      phase: "declare_blocks",
      players: { a: player(20), b: player(20) },
      attacks: [{ attackerPlayerId: "a", attackerCardId: "QC" }],
    });
    const after = view({
      phase: "main",
      players: { a: player(20), b: player(17) },
      lastCombatSummary: {
        pairs: [{ attackerCardId: "QC", blockerCardIds: [], directDamage: 3, targetPlayerId: "b" }],
        immediateHits: [
          { attackerCardId: "QC", blockerCardIds: [], directDamage: 3, targetPlayerId: "b" },
        ],
      },
    });
    const events = diff(before, after);
    // One club damage effect on b, not doubled by the pairs list, with the
    // hit attributed back to the attacking player and card (for audio gating).
    const combat = events.filter((e) => e.kind === "damage");
    expect(combat).toHaveLength(1);
    expect(combat[0]).toMatchObject({
      suit: "C",
      kind: "damage",
      playerId: "b",
      amount: 3,
      sourcePlayerId: "a",
      sourceCardId: "QC",
    });
  });

  it("does not re-fire the same immediateHits on the next snapshot", () => {
    const summary = {
      pairs: [{ attackerCardId: "QC", blockerCardIds: [], directDamage: 3, targetPlayerId: "b" }],
      immediateHits: [
        { attackerCardId: "QC", blockerCardIds: [], directDamage: 3, targetPlayerId: "b" },
      ],
    };
    const resolved = view({
      phase: "main",
      players: { a: player(20), b: player(17) },
      lastCombatSummary: summary,
    });
    // A later identical snapshot (summary still present) must produce nothing.
    expect(diff(resolved, resolved)).toEqual([]);
  });

  it("fires a destroy on the seat when a blocker royal dies in a duel", () => {
    const before = view({
      phase: "duel_attacker_turn",
      players: { a: player(20, [{ cardId: "KS" }]), b: player(20, [{ cardId: "JH" }]) },
      attacks: [{ attackerPlayerId: "a", attackerCardId: "KS" }],
    });
    const after = view({
      phase: "main",
      players: { a: player(20, [{ cardId: "KS" }]), b: player(20) }, // JH gone
      lastCombatSummary: {
        pairs: [
          {
            attackerCardId: "KS",
            blockerCardIds: ["JH"],
            attackerDestroyed: false,
            blockerDestroyed: true,
            directDamage: 0,
            targetPlayerId: "b",
          },
        ],
      },
    });
    const events = diff(before, after);
    const destroy = events.filter((e) => e.kind === "destroy");
    expect(destroy).toHaveLength(1);
    expect(destroy[0]).toMatchObject({
      suit: "S",
      kind: "destroy",
      playerId: "b",
      sourcePlayerId: "a",
      sourceCardId: "KS",
    });
  });

  it("attributes a dead attacker's destroy to the blocker's suit on the attacker's seat", () => {
    const before = view({
      phase: "duel_attacker_turn",
      players: { a: player(20, [{ cardId: "JS" }]), b: player(20, [{ cardId: "KH" }]) },
      attacks: [{ attackerPlayerId: "a", attackerCardId: "JS" }],
    });
    const after = view({
      phase: "main",
      players: { a: player(20), b: player(20, [{ cardId: "KH" }]) }, // JS gone
      lastCombatSummary: {
        pairs: [
          {
            attackerCardId: "JS",
            blockerCardIds: ["KH"],
            attackerDestroyed: true,
            blockerDestroyed: false,
            directDamage: 0,
            targetPlayerId: "b",
          },
        ],
      },
    });
    const events = diff(before, after);
    const destroy = events.filter((e) => e.kind === "destroy");
    expect(destroy).toHaveLength(1);
    // Blocker was a Heart; effect lands on the attacker's own seat "a",
    // caused by the defender "b" whose blocker won the trade.
    expect(destroy[0]).toMatchObject({
      suit: "H",
      kind: "destroy",
      playerId: "a",
      sourcePlayerId: "b",
      sourceCardId: "KH",
    });
  });

  it("treats any life gain as a Hearts heal", () => {
    const before = view({ players: { a: player(14) } });
    const after = view({ players: { a: player(18) } });
    const events = diff(before, after);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      suit: "H",
      kind: "heal",
      playerId: "a",
      amount: 4,
      sourcePlayerId: "a",
    });
  });

  it("fires a buff on the royal when a spade attaches", () => {
    const before = view({ players: { a: player(20, [{ cardId: "KD", attachedCards: [] }]) } });
    const after = view({ players: { a: player(20, [{ cardId: "KD", attachedCards: ["7S"] }]) } });
    const events = diff(before, after);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      suit: "S",
      kind: "buff",
      playerId: "a",
      royalId: "KD",
      sourceCardId: "7S",
    });
  });

  it("fires a debuff on the royal when a club attaches", () => {
    const before = view({ players: { a: player(20, [{ cardId: "KD", attachedCards: [] }]) } });
    const after = view({ players: { a: player(20, [{ cardId: "KD", attachedCards: ["4C"] }]) } });
    const events = diff(before, after);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ suit: "C", kind: "debuff", playerId: "a", royalId: "KD" });
  });

  it("does not treat a newly-played royal (with attachments) as an attachment hit", () => {
    const before = view({ players: { a: player(20, []) } });
    const after = view({ players: { a: player(20, [{ cardId: "QH", attachedCards: ["3S"] }]) } });
    // The royal didn't exist before, so its attachments aren't 'new' hits.
    expect(diff(before, after)).toEqual([]);
  });

  it("fires the club effect when a pending club resolves by cancelling (no attachment persists)", () => {
    const pending = {
      attackerPlayerId: "a",
      clubCardId: "4C",
      targetPlayerId: "b",
      targetRoyalId: "KD",
    };
    const before = view({
      phase: "respond_to_club",
      players: { a: player(20), b: player(20, [{ cardId: "KD", attachedCards: ["4S"] }]) },
      pendingClubDebuff: pending,
    });
    // Club and spade cancelled each other — royal survives, nothing attached.
    const after = view({
      phase: "main",
      players: { a: player(20), b: player(20, [{ cardId: "KD", attachedCards: [] }]) },
    });
    const events = diff(before, after);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      suit: "C",
      kind: "debuff",
      playerId: "b",
      royalId: "KD",
      sourcePlayerId: "a",
      sourceCardId: "4C",
    });
  });

  it("fires a seat-level club destroy when a pending club kills the royal", () => {
    const pending = {
      attackerPlayerId: "a",
      clubCardId: "9C",
      targetPlayerId: "b",
      targetRoyalId: "JD",
    };
    const before = view({
      phase: "respond_to_club",
      players: { a: player(20), b: player(20, [{ cardId: "JD" }]) },
      pendingClubDebuff: pending,
    });
    const after = view({
      phase: "main",
      players: { a: player(20), b: player(20) }, // JD gone
    });
    const events = diff(before, after);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      suit: "C",
      kind: "destroy",
      playerId: "b",
      sourcePlayerId: "a",
      sourceCardId: "9C",
    });
    expect(events[0]!.royalId).toBeUndefined();
  });

  it("does not double-fire when the pending club sticks as an attachment", () => {
    const pending = {
      attackerPlayerId: "a",
      clubCardId: "4C",
      targetPlayerId: "b",
      targetRoyalId: "KD",
    };
    const before = view({
      phase: "respond_to_club",
      players: { a: player(20), b: player(20, [{ cardId: "KD", attachedCards: [] }]) },
      pendingClubDebuff: pending,
    });
    const after = view({
      phase: "main",
      players: { a: player(20), b: player(20, [{ cardId: "KD", attachedCards: ["4C"] }]) },
    });
    const events = diff(before, after);
    // Exactly one debuff — from the attachment diff (rule 4), not rule 4b too.
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ suit: "C", kind: "debuff", royalId: "KD" });
  });

  it("fires a direct burn when lastDirectHit.seq changes, attributed to the source suit", () => {
    const before = view({
      players: { a: player(20), b: player(20) },
      lastDirectHit: { sourceCardId: "5D", targetPlayerId: "b", amount: 3, seq: 1 },
    });
    const after = view({
      players: { a: player(20), b: player(15) },
      lastDirectHit: { sourceCardId: "6C", targetPlayerId: "b", amount: 5, seq: 2 },
    });
    const events = diff(before, after);
    const burn = events.filter((e) => e.suit === "C");
    expect(burn).toHaveLength(1);
    expect(burn[0]).toMatchObject({ suit: "C", kind: "damage", playerId: "b", amount: 5 });
  });

  it("attributes a Joker burn to the JOKER effect suit", () => {
    const before = view({ players: { a: player(20), b: player(20) } });
    const after = view({
      players: { a: player(20), b: player(10) },
      lastDirectHit: { sourceCardId: "JOKER1", targetPlayerId: "b", amount: 10, seq: 1 },
    });
    const events = diff(before, after);
    expect(events.some((e) => e.suit === "JOKER" && e.kind === "damage" && e.playerId === "b")).toBe(
      true,
    );
  });

  it("caps effects per target and staggers their delays", () => {
    const royals = Array.from({ length: 5 }, (_, i) => ({ cardId: `R${i}` }));
    const before = view({ players: { a: player(20, royals.map((r) => ({ cardId: r.cardId, attachedCards: [] }))) } });
    // Attach a spade to all five of a's royals in one snapshot → 5 buff events,
    // all keyed to seat/royal 'a' targets but each a distinct royalId.
    const after = view({
      players: {
        a: player(20, royals.map((r) => ({ cardId: r.cardId, attachedCards: ["2S"] }))),
      },
    });
    const events = diff(before, after);
    // Different royals are different targets, so each gets its own (i=0) event.
    expect(events).toHaveLength(5);
    for (const e of events) expect(e.delayMs).toBe(0);
  });

  it("caps to MAX_EFFECTS_PER_TARGET when many hits land on one seat", () => {
    const before = view({
      phase: "declare_blocks",
      players: { a: player(20), b: player(20) },
    });
    const hits = Array.from({ length: MAX_EFFECTS_PER_TARGET + 2 }, (_, i) => ({
      attackerCardId: `${i + 2}C`,
      blockerCardIds: [],
      directDamage: 1,
      targetPlayerId: "b",
    }));
    const after = view({
      phase: "main",
      players: { a: player(20), b: player(10) },
      lastCombatSummary: { pairs: hits, immediateHits: hits },
    });
    const events = diff(before, after).filter((e) => e.playerId === "b" && e.kind === "damage");
    expect(events).toHaveLength(MAX_EFFECTS_PER_TARGET);
    // Staggered 0, 220, 440, ...
    expect(events.map((e) => e.delayMs)).toEqual(
      Array.from({ length: MAX_EFFECTS_PER_TARGET }, (_, i) => i * 220),
    );
  });
});
