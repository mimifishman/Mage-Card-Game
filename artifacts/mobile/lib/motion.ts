import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { Easing } from "react-native-reanimated";

// ── Shared motion vocabulary ─────────────────────────────────────────────
// One place for durations, easings and spring configs so every cinematic
// beat (deal, play, lunge, clash, victory) moves in the same dialect.
// Everything animates transform/opacity only — see the interop rule in
// components/game/effects/SuitHitEffect.tsx.

export const Durations = {
  fast: 140,
  base: 220,
  slow: 400,
  cinematic: 650,
  /** Ambient loops (glow breathing, rune rotation) — long and lazy. */
  ambient: 3200,
};

export const Easings = {
  out: Easing.out(Easing.quad),
  in: Easing.in(Easing.quad),
  inOut: Easing.inOut(Easing.quad),
  /** Overshooting arc for card flights — fast launch, soft landing. */
  arc: Easing.bezier(0.22, 1, 0.36, 1),
  linear: Easing.linear,
};

export const Springs = {
  /** A card settling onto the board. */
  land: { damping: 14, stiffness: 180, mass: 0.8 },
  /** An attacker lunging at its target. */
  lunge: { damping: 12, stiffness: 260, mass: 0.7 },
};

/**
 * OS-level Reduce Motion. When true, cinematic/ambient animation should
 * degrade to simple fades or render statically. Defaults to false until the
 * async lookup resolves (worst case: one animated frame for those users).
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setReduced(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
