import { parseCardId } from "@/lib/gameUtils";

// Pure snapshot-diff engine behind the suit hit effects. This module must
// stay free of react-native / expo imports — it runs under vitest's plain
// node environment (see lib/__tests__/hitEffects.test.ts). The hook that
// consumes it (with haptics + sound) lives in lib/hitEffects.ts.
//
// The server never sends per-event messages — clients only see before/after
// GameState snapshots — so every "a hit landed" signal here is a diff between
// the previous slice and the incoming view.

export type EffectSuit = "C" | "H" | "D" | "S" | "JOKER";
export type EffectKind = "damage" | "heal" | "buff" | "debuff" | "destroy";

export interface HitEffectEvent {
  /** Globally unique per mounted effect — used as the React key. */
  id: string;
  suit: EffectSuit;
  kind: EffectKind;
  /** Seat the effect belongs to (royal events carry their owner here too). */
  playerId: string;
  /** Present → render on that royal card in CourtZone instead of the seat. */
  royalId?: string;
  amount?: number;
  /** Stagger within a batch so simultaneous hits read as distinct. */
  delayMs: number;
  /**
   * Who caused the event, when derivable from the snapshot (combat hits,
   * heals). Attachments/burns carry only sourceCardId — the local caster is
   * recognized via the recent-cast registry in lib/hitEffects.ts. Used to
   * decide whether THIS device should hear the sound.
   */
  sourcePlayerId?: string;
  /** The card that caused the event (attacker / attachment / burn source). */
  sourceCardId?: string;
}

/** How long a mounted effect lives before the hook drops it (past the longest choreography). */
export const EFFECT_TTL_MS = 1400;
/** Stagger between same-target events landing in one snapshot. */
export const EFFECT_STAGGER_MS = 220;
/** Max simultaneous effects per target; the event ticker still logs the rest. */
export const MAX_EFFECTS_PER_TARGET = 3;

// Minimal structural slice of PlayerGameView — typed locally so this module
// (and its tests) don't depend on the generated API client, and so
// `lastDirectHit` works before/after the orval regen picks it up.
interface CombatHitView {
  attackerCardId: string;
  blockerCardIds?: string[];
  attackerDestroyed?: boolean;
  blockerDestroyed?: boolean;
  directDamage: number;
  targetPlayerId: string;
}

export interface HitEffectsView {
  phase: string;
  turnNumber: number;
  players: Record<
    string,
    { life: number; court: { cardId: string; attachedCards: string[] }[] }
  >;
  attacks?: { attackerPlayerId: string; attackerCardId: string }[];
  duelContext?: { immediateHits?: CombatHitView[] } | null;
  lastCombatSummary?: { pairs?: CombatHitView[]; immediateHits?: CombatHitView[] } | null;
  lastDirectHit?: {
    sourceCardId: string;
    targetPlayerId: string;
    amount: number;
    seq: number;
  } | null;
}

export interface PrevSlice {
  phase: string;
  /** Content key of the immediateHits already shown — the double-fire guard. */
  immediateHitsKey: string;
  directHitSeq: number;
  /** attackerCardId → owning playerId, captured while attacks are declared. */
  attackOwners: Record<string, string>;
  players: Record<
    string,
    { life: number; royals: Record<string, string[]> } // royalId → attachedCards
  >;
}

const COMBAT_PHASES = new Set([
  "declare_blocks",
  "assign_damage_order",
  "duel_attacker_turn",
  "duel_blocker_turn",
  "resolve_combat",
]);

function toEffectSuit(suit: string): EffectSuit {
  return suit === "C" || suit === "H" || suit === "D" || suit === "S" ? suit : "JOKER";
}

function currentImmediateHits(view: HitEffectsView): CombatHitView[] {
  return view.duelContext?.immediateHits ?? view.lastCombatSummary?.immediateHits ?? [];
}

// lastCombatSummary persists until the NEXT combat clears it, and polling can
// replay identical snapshots — so unblocked hits fire once per content key
// (turn number + attacker→target list), never on mere presence.
function immediateHitsKey(turnNumber: number, hits: CombatHitView[]): string {
  if (hits.length === 0) return "";
  return `${turnNumber}:${hits.map((h) => `${h.attackerCardId}>${h.targetPlayerId}`).join(",")}`;
}

export function toPrevSlice(view: HitEffectsView): PrevSlice {
  const players: PrevSlice["players"] = {};
  for (const [pid, p] of Object.entries(view.players)) {
    players[pid] = {
      life: p.life,
      royals: Object.fromEntries(p.court.map((r) => [r.cardId, [...r.attachedCards]])),
    };
  }
  return {
    phase: view.phase,
    immediateHitsKey: immediateHitsKey(view.turnNumber, currentImmediateHits(view)),
    directHitSeq: view.lastDirectHit?.seq ?? 0,
    attackOwners: Object.fromEntries(
      (view.attacks ?? []).map((a) => [a.attackerCardId, a.attackerPlayerId]),
    ),
    players,
  };
}

/**
 * Pure snapshot diff → hit-effect events. `batchSeq` only namespaces ids.
 * Returns [] for the first snapshot (nothing to diff against) and for
 * repeated identical snapshots.
 */
export function diffHitEffects(
  prev: PrevSlice | null,
  view: HitEffectsView,
  batchSeq: number,
): HitEffectEvent[] {
  if (!prev) return [];

  const raw: Omit<HitEffectEvent, "id" | "delayMs">[] = [];

  // 1. Unblocked combat hits — attributed via the attacker card, fired once
  //    per content key the moment the server publishes them.
  const hits = currentImmediateHits(view);
  const hitsKey = immediateHitsKey(view.turnNumber, hits);
  if (hits.length > 0 && hitsKey !== prev.immediateHitsKey) {
    for (const h of hits) {
      raw.push({
        suit: toEffectSuit(parseCardId(h.attackerCardId).suit),
        kind: "damage",
        playerId: h.targetPlayerId,
        amount: h.directDamage,
        sourcePlayerId: prev.attackOwners[h.attackerCardId],
        sourceCardId: h.attackerCardId,
      });
    }
  }

  // 2. Duel outcomes — blocked pairs only (unblocked ones are duplicated into
  //    both `pairs` and `immediateHits` by the server and already fired above).
  //    Destroyed royals are gone from the court in this same snapshot, so
  //    destroy effects anchor to the seat, not a royal.
  const wasCombat = COMBAT_PHASES.has(prev.phase);
  const nowResolved = view.phase === "main" || view.phase === "draw";
  if (wasCombat && nowResolved) {
    for (const pair of view.lastCombatSummary?.pairs ?? []) {
      const blockers = pair.blockerCardIds ?? [];
      if (blockers.length === 0) continue;
      const attackerSuit = toEffectSuit(parseCardId(pair.attackerCardId).suit);
      if (pair.blockerDestroyed) {
        raw.push({
          suit: attackerSuit,
          kind: "destroy",
          playerId: pair.targetPlayerId,
          sourcePlayerId: prev.attackOwners[pair.attackerCardId],
          sourceCardId: pair.attackerCardId,
        });
      }
      if (pair.attackerDestroyed) {
        const attackerOwner = prev.attackOwners[pair.attackerCardId];
        if (attackerOwner) {
          raw.push({
            suit: toEffectSuit(parseCardId(blockers[0]!).suit),
            kind: "destroy",
            playerId: attackerOwner,
            sourcePlayerId: pair.targetPlayerId,
            sourceCardId: blockers[0]!,
          });
        }
      }
    }
  }

  // 3+4. Per-player diffs: heals (always Hearts by rule) and new attachments
  //      (Clubs debuff, everything else buffs).
  for (const [pid, p] of Object.entries(view.players)) {
    const before = prev.players[pid];
    if (!before) continue;

    const lifeDelta = p.life - before.life;
    if (lifeDelta > 0) {
      raw.push({ suit: "H", kind: "heal", playerId: pid, amount: lifeDelta, sourcePlayerId: pid });
    }

    for (const royal of p.court) {
      const beforeAttached = before.royals[royal.cardId];
      if (!beforeAttached) continue; // royal just entered play — not a hit
      for (const cid of royal.attachedCards) {
        if (beforeAttached.includes(cid)) continue;
        const suit = toEffectSuit(parseCardId(cid).suit);
        raw.push({
          suit,
          kind: suit === "C" ? "debuff" : "buff",
          playerId: pid,
          royalId: royal.cardId,
          sourceCardId: cid,
        });
      }
    }
  }

  // 5. Direct (non-combat) burn — Club face damage / Joker damage, attributed
  //    server-side via lastDirectHit's monotonic seq.
  const dh = view.lastDirectHit;
  if (dh && dh.seq !== prev.directHitSeq) {
    raw.push({
      suit: toEffectSuit(parseCardId(dh.sourceCardId).suit),
      kind: "damage",
      playerId: dh.targetPlayerId,
      amount: dh.amount,
      sourceCardId: dh.sourceCardId,
    });
  }

  // Stagger + cap per target, assign stable ids.
  const counts: Record<string, number> = {};
  const events: HitEffectEvent[] = [];
  for (const e of raw) {
    const targetKey = e.royalId ?? e.playerId;
    const i = counts[targetKey] ?? 0;
    if (i >= MAX_EFFECTS_PER_TARGET) continue;
    counts[targetKey] = i + 1;
    events.push({ ...e, id: `${batchSeq}:${targetKey}:${i}`, delayMs: i * EFFECT_STAGGER_MS });
  }
  return events;
}
