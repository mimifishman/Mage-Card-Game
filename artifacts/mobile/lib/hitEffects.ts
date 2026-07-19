import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import {
  diffHitEffects,
  toPrevSlice,
  EFFECT_TTL_MS,
  type EffectKind,
  type HitEffectEvent,
  type HitEffectsView,
  type PrevSlice,
} from "@/lib/hitEffectsDiff";
import { playGameSfx, playSuitSfx } from "@/lib/sfx";

// React side of the suit hit effects: feeds each incoming GameState snapshot
// through the pure diff (lib/hitEffectsDiff.ts), keeps the currently-alive
// events keyed by seat and by royal, and fires haptics + SFX per batch.
// Deliberately separate from the event-ticker diff in match.tsx
// (`prevPlayersRef`) — don't entangle the two.

export * from "@/lib/hitEffectsDiff";

// ── Recent-cast registry ─────────────────────────────────────────────────
// The snapshot can't always name the caster (attachments and burns only
// carry the card id), so the match screen registers every card the local
// player submits. If an event's source card was cast here recently, this
// device caused it — and should hear it.
const RECENT_CAST_TTL_MS = 6000;
const recentCasts = new Map<string, number>();

/** Called by the match screen whenever the local player plays a card. */
export function markLocalCast(cardId: string): void {
  const now = Date.now();
  recentCasts.set(cardId, now);
  // Opportunistic cleanup — the map stays tiny.
  for (const [id, at] of recentCasts) {
    if (now - at > RECENT_CAST_TTL_MS) recentCasts.delete(id);
  }
}

function wasRecentlyCastByMe(cardId: string | undefined): boolean {
  if (!cardId) return false;
  const at = recentCasts.get(cardId);
  return at !== undefined && Date.now() - at <= RECENT_CAST_TTL_MS;
}

// Audio rule: this device only plays a hit sound when its player is involved
// — their stuff was affected, or they caused the hit. Visuals and the ticker
// still show everything; sound stays personal.
function isAudibleToMe(e: HitEffectEvent, myId: string): boolean {
  return (
    e.playerId === myId ||
    e.sourcePlayerId === myId ||
    wasRecentlyCastByMe(e.sourceCardId)
  );
}

const KIND_RANK: Record<EffectKind, number> = {
  destroy: 3,
  damage: 2,
  heal: 1,
  buff: 0,
  debuff: 0,
};

// One buzz per batch — the strongest event wins, my-seat events outrank
// remote ones. Anything more is buzz spam in a 4-player game.
function buzzForBatch(events: HitEffectEvent[], myId: string): void {
  if (Platform.OS === "web" || events.length === 0) return;
  let top = events[0]!;
  for (const e of events) {
    const better =
      KIND_RANK[e.kind] > KIND_RANK[top.kind] ||
      (KIND_RANK[e.kind] === KIND_RANK[top.kind] &&
        e.playerId === myId &&
        top.playerId !== myId);
    if (better) top = e;
  }
  try {
    if (top.kind === "destroy") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (top.kind === "damage") {
      Haptics.impactAsync(
        top.playerId === myId
          ? Haptics.ImpactFeedbackStyle.Heavy
          : Haptics.ImpactFeedbackStyle.Light,
      );
    } else if (top.kind === "heal") {
      if (top.playerId === myId) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else if (top.playerId === myId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Haptics are decoration — never let them break the game loop.
  }
}

/**
 * Diffs each incoming snapshot into hit-effect events and exposes the ones
 * currently alive, keyed by seat (playerId) and by royal (cardId).
 */
export function useHitEffects(
  view: HitEffectsView | null | undefined,
  myId: string,
): {
  seatEffects: Record<string, HitEffectEvent[]>;
  royalEffects: Record<string, HitEffectEvent[]>;
} {
  const prevRef = useRef<PrevSlice | null>(null);
  const batchSeqRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [seatEffects, setSeatEffects] = useState<Record<string, HitEffectEvent[]>>({});
  const [royalEffects, setRoyalEffects] = useState<Record<string, HitEffectEvent[]>>({});

  useEffect(() => {
    if (!view) return;
    const events = diffHitEffects(prevRef.current, view, batchSeqRef.current++);
    prevRef.current = toPrevSlice(view);
    if (events.length === 0) return;

    const seatAdds: Record<string, HitEffectEvent[]> = {};
    const royalAdds: Record<string, HitEffectEvent[]> = {};
    for (const e of events) {
      const bucket = e.royalId ? royalAdds : seatAdds;
      const key = e.royalId ?? e.playerId;
      (bucket[key] ??= []).push(e);
    }
    if (Object.keys(seatAdds).length > 0) {
      setSeatEffects((cur) => mergeAdds(cur, seatAdds));
    }
    if (Object.keys(royalAdds).length > 0) {
      setRoyalEffects((cur) => mergeAdds(cur, royalAdds));
    }

    for (const e of events) {
      const key = e.royalId ?? e.playerId;
      const setFor = e.royalId ? setRoyalEffects : setSeatEffects;
      timersRef.current.push(
        setTimeout(() => setFor((cur) => dropEvent(cur, key, e.id)), e.delayMs + EFFECT_TTL_MS),
      );
      if (isAudibleToMe(e, myId)) {
        timersRef.current.push(
          setTimeout(
            () =>
              e.kind === "destroy" ? playGameSfx("doom") : playSuitSfx(e.suit, e.kind),
            e.delayMs,
          ),
        );
      }
    }

    buzzForBatch(events, myId);
  }, [view]);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
    },
    [],
  );

  return { seatEffects, royalEffects };
}

function mergeAdds(
  cur: Record<string, HitEffectEvent[]>,
  adds: Record<string, HitEffectEvent[]>,
): Record<string, HitEffectEvent[]> {
  const next = { ...cur };
  for (const [key, events] of Object.entries(adds)) {
    next[key] = [...(next[key] ?? []), ...events];
  }
  return next;
}

function dropEvent(
  cur: Record<string, HitEffectEvent[]>,
  key: string,
  id: string,
): Record<string, HitEffectEvent[]> {
  const list = cur[key];
  if (!list?.some((e) => e.id === id)) return cur;
  const remaining = list.filter((e) => e.id !== id);
  const next = { ...cur };
  if (remaining.length === 0) delete next[key];
  else next[key] = remaining;
  return next;
}
