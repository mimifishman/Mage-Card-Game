import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path, Polygon, Rect } from "react-native-svg";
import { SUIT_FX, type SuitFxKey } from "@/constants/colors";
import type { EffectKind } from "@/lib/hitEffectsDiff";

// One-shot, suit-themed hit effect. Mounted inside an absolute-fill,
// pointerEvents:"none" overlay; it centers itself and plays once (the
// useHitEffects hook unmounts it when the event expires).
//
// Interop rule: every SVG element is STATIC (fixed props). All motion is
// opacity/transform on plain Animated.View wrappers — animated SVG props are
// flaky under reanimated 4 / the New Architecture, transforms are not.

export interface SuitHitEffectProps {
  suit: SuitFxKey;
  kind: EffectKind;
  /** Stagger start for batched hits; the whole choreography shifts by this. */
  delayMs?: number;
  /** Square overlay edge in px. All geometry is authored at 72 and scaled. */
  size?: number;
}

const BASE = 72;

export default function SuitHitEffect({ suit, kind, delayMs = 0, size = BASE }: SuitHitEffectProps) {
  const fx = SUIT_FX[suit] ?? SUIT_FX.JOKER;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.root,
        {
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
        },
      ]}
    >
      <View
        style={[
          styles.stage,
          {
            left: (size - BASE) / 2,
            top: (size - BASE) / 2,
            transform: [{ scale: size / BASE }],
          },
        ]}
      >
        {kind === "destroy" && <DestroyFlash delayMs={delayMs} />}
        {suit === "C" &&
          (kind === "debuff" || kind === "buff" ? (
            <ClubMace delayMs={delayMs} fx={fx} />
          ) : (
            <ClubBolt delayMs={delayMs} fx={fx} />
          ))}
        {suit === "H" && (kind === "damage" ? <HeartRing delayMs={delayMs} fx={fx} /> : <HeartBloom delayMs={delayMs} fx={fx} />)}
        {suit === "D" && <ShardBurst delayMs={delayMs} fx={fx} gem="diamond" />}
        {suit === "S" && <SpadeSword delayMs={delayMs} fx={fx} withShield={kind === "buff"} />}
        {suit === "JOKER" && <ShardBurst delayMs={delayMs} fx={fx} gem="star" />}
      </View>
    </View>
  );
}

type Fx = { core: string; accent: string; flash: string };

/** Brief red wash behind the suit effect when something was destroyed. */
function DestroyFlash({ delayMs }: { delayMs: number }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withDelay(
      delayMs,
      withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 220 })),
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.destroyFlash, style]} />;
}

/** Clubs — green lightning strike: bolt slams down, flickers, impact ring. */
function ClubBolt({ delayMs, fx }: { delayMs: number; fx: Fx }) {
  const boltOpacity = useSharedValue(0);
  const boltDrop = useSharedValue(-BASE / 2);
  const boltScaleY = useSharedValue(0);
  const impactScale = useSharedValue(0.2);
  const impactOpacity = useSharedValue(0);

  useEffect(() => {
    boltOpacity.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1, { duration: 90 }),
        withRepeat(
          withSequence(withTiming(0.35, { duration: 50 }), withTiming(1, { duration: 50 })),
          3,
        ),
        withTiming(0, { duration: 150 }),
      ),
    );
    boltDrop.value = withDelay(delayMs, withTiming(0, { duration: 90, easing: Easing.in(Easing.quad) }));
    boltScaleY.value = withDelay(delayMs, withTiming(1, { duration: 90, easing: Easing.in(Easing.quad) }));
    impactScale.value = withDelay(delayMs + 90, withTiming(1.5, { duration: 300, easing: Easing.out(Easing.quad) }));
    impactOpacity.value = withDelay(
      delayMs + 90,
      withSequence(withTiming(0.9, { duration: 60 }), withTiming(0, { duration: 240 })),
    );
  }, []);

  const boltStyle = useAnimatedStyle(() => ({
    opacity: boltOpacity.value,
    transform: [{ translateY: boltDrop.value }, { scaleY: boltScaleY.value }],
  }));
  const impactStyle = useAnimatedStyle(() => ({
    opacity: impactOpacity.value,
    transform: [{ scale: impactScale.value }],
  }));

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, boltStyle]}>
        <Svg width={BASE} height={BASE} viewBox="0 0 60 60">
          <Polygon
            points="30,0 22,26 30,26 18,58 42,22 32,22 40,0"
            fill={fx.accent}
            stroke={fx.flash}
            strokeWidth={1.5}
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[styles.centered, impactStyle]}
      >
        <View style={[styles.impactCircle, { backgroundColor: fx.accent }]} />
      </Animated.View>
    </>
  );
}

/**
 * Clubs as an attachment — a heavy cudgel drops onto the royal, the club-suit
 * counterpart to the Spade sword: fall, thud, recoil, dust. Lightning stays
 * the club DAMAGE effect; this is the "a club just landed on you" beat.
 */
function ClubMace({ delayMs, fx }: { delayMs: number; fx: Fx }) {
  const maceOpacity = useSharedValue(0);
  const maceDrop = useSharedValue(-64);
  const maceTilt = useSharedValue(-14);
  const dustOpacity = useSharedValue(0);
  const dustScale = useSharedValue(0.6);

  useEffect(() => {
    maceOpacity.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1, { duration: 60 }),
        withTiming(1, { duration: 540 }),
        withTiming(0, { duration: 200 }),
      ),
    );
    maceDrop.value = withDelay(
      delayMs + 60,
      withSequence(
        withTiming(0, { duration: 170, easing: Easing.in(Easing.quad) }),
        withTiming(4, { duration: 70 }),
        withTiming(0, { duration: 70 }),
      ),
    );
    maceTilt.value = withDelay(delayMs + 60, withTiming(0, { duration: 170 }));
    dustOpacity.value = withDelay(
      delayMs + 230,
      withSequence(withTiming(0.9, { duration: 100 }), withTiming(0, { duration: 150 })),
    );
    dustScale.value = withDelay(delayMs + 230, withTiming(1.2, { duration: 250, easing: Easing.out(Easing.quad) }));
  }, []);

  const maceStyle = useAnimatedStyle(() => ({
    opacity: maceOpacity.value,
    transform: [{ translateY: maceDrop.value }, { rotate: `${maceTilt.value}deg` }],
  }));
  const dustStyle = useAnimatedStyle(() => ({
    opacity: dustOpacity.value,
    transform: [{ scale: dustScale.value }],
  }));

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, maceStyle]}>
        <Svg width={BASE} height={BASE} viewBox="0 0 60 60">
          {/* pommel, wooden shaft, banded grip, studded head (tip down) */}
          <Circle cx={30} cy={5} r={2.5} fill="#C89B3C" />
          <Rect x={28} y={6} width={4} height={26} rx={1.5} fill="#6B4A2A" stroke={fx.core} strokeWidth={1} />
          <Rect x={26.5} y={26} width={7} height={3} rx={1} fill="#C89B3C" />
          <Circle cx={30} cy={41} r={9} fill={fx.accent} stroke={fx.core} strokeWidth={1.5} />
          {/* studs */}
          <Circle cx={30} cy={33} r={1.6} fill={fx.flash} />
          <Circle cx={37} cy={39} r={1.6} fill={fx.flash} />
          <Circle cx={34} cy={47} r={1.6} fill={fx.flash} />
          <Circle cx={26} cy={47} r={1.6} fill={fx.flash} />
          <Circle cx={23} cy={39} r={1.6} fill={fx.flash} />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, dustStyle]}>
        <Svg width={BASE} height={BASE} viewBox="0 0 60 60">
          <Path d="M18 52 Q12 48 10 42" stroke={fx.accent} strokeWidth={2} fill="none" strokeLinecap="round" />
          <Path d="M42 52 Q48 48 50 42" stroke={fx.accent} strokeWidth={2} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </>
  );
}

// Small heart, authored in a 12x12 box.
const HEART_PATH =
  "M6 11 C6 11 0.5 7 0.5 3.5 C0.5 1.5 2 0 3.75 0 C4.75 0 5.6 0.6 6 1.4 C6.4 0.6 7.25 0 8.25 0 C10 0 11.5 1.5 11.5 3.5 C11.5 7 6 11 6 11 Z";

/** Hearts — heal bloom: expanding ring, soft glow, three rising hearts. */
function HeartBloom({ delayMs, fx }: { delayMs: number; fx: Fx }) {
  return (
    <>
      <BloomRing delayMs={delayMs} fx={fx} />
      {[-16, 0, 16].map((dx, i) => (
        <RisingHeart key={dx} delayMs={delayMs + i * 120} dx={dx} fx={fx} />
      ))}
    </>
  );
}

/** Hearts as a damage source (rare): the ring/glow without rising hearts. */
function HeartRing({ delayMs, fx }: { delayMs: number; fx: Fx }) {
  return <BloomRing delayMs={delayMs} fx={fx} />;
}

function BloomRing({ delayMs, fx }: { delayMs: number; fx: Fx }) {
  const ringScale = useSharedValue(0.5);
  const ringOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.6);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    ringScale.value = withDelay(delayMs, withTiming(1.4, { duration: 500, easing: Easing.out(Easing.quad) }));
    ringOpacity.value = withDelay(
      delayMs,
      withSequence(withTiming(0.8, { duration: 80 }), withTiming(0, { duration: 420 })),
    );
    glowScale.value = withDelay(delayMs, withTiming(1.2, { duration: 500, easing: Easing.out(Easing.quad) }));
    glowOpacity.value = withDelay(
      delayMs,
      withSequence(withTiming(0.5, { duration: 120 }), withTiming(0, { duration: 380 })),
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <>
      <Animated.View style={[styles.centered, glowStyle]}>
        <View style={[styles.glowCircle, { backgroundColor: fx.core }]} />
      </Animated.View>
      <Animated.View style={[styles.centered, ringStyle]}>
        <View style={[styles.bloomRing, { borderColor: fx.accent }]} />
      </Animated.View>
    </>
  );
}

function RisingHeart({ delayMs, dx, fx }: { delayMs: number; dx: number; fx: Fx }) {
  const rise = useSharedValue(6);
  const opacity = useSharedValue(0);

  useEffect(() => {
    rise.value = withDelay(delayMs, withTiming(-34, { duration: 600, easing: Easing.out(Easing.quad) }));
    opacity.value = withDelay(
      delayMs,
      withSequence(withTiming(1, { duration: 250 }), withTiming(0, { duration: 350 })),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: dx }, { translateY: rise.value }],
  }));

  return (
    <Animated.View style={[styles.centered, style]}>
      <Svg width={12} height={12} viewBox="0 0 12 12">
        <Path d={HEART_PATH} fill={fx.accent} stroke={fx.flash} strokeWidth={0.5} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Diamonds / Joker — a gem (or star) flies in, then a burst of shards and a
 * white flash. Shards are one static SVG group scaled/faded as a whole.
 */
function ShardBurst({ delayMs, fx, gem }: { delayMs: number; fx: Fx; gem: "diamond" | "star" }) {
  const gemX = useSharedValue(38);
  const gemY = useSharedValue(-38);
  const gemScale = useSharedValue(0.6);
  const gemOpacity = useSharedValue(0);
  const shardScale = useSharedValue(0);
  const shardOpacity = useSharedValue(1);
  const flashScale = useSharedValue(0.3);
  const flashOpacity = useSharedValue(0);

  useEffect(() => {
    const flyIn = { duration: 220, easing: Easing.in(Easing.quad) } as const;
    gemOpacity.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1, { duration: 40 }),
        withTiming(1, { duration: 180 }),
        withTiming(0, { duration: 80 }),
      ),
    );
    gemX.value = withDelay(delayMs, withTiming(0, flyIn));
    gemY.value = withDelay(delayMs, withTiming(0, flyIn));
    gemScale.value = withDelay(delayMs, withTiming(1, flyIn));
    shardScale.value = withDelay(delayMs + 220, withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }));
    shardOpacity.value = withDelay(delayMs + 370, withTiming(0, { duration: 350 }));
    flashScale.value = withDelay(delayMs + 220, withTiming(1.3, { duration: 250, easing: Easing.out(Easing.quad) }));
    flashOpacity.value = withDelay(
      delayMs + 220,
      withSequence(withTiming(0.9, { duration: 60 }), withTiming(0, { duration: 190 })),
    );
  }, []);

  const gemStyle = useAnimatedStyle(() => ({
    opacity: gemOpacity.value,
    transform: [
      { translateX: gemX.value },
      { translateY: gemY.value },
      { scale: gemScale.value },
    ],
  }));
  const shardStyle = useAnimatedStyle(() => ({
    opacity: shardOpacity.value,
    transform: [{ scale: shardScale.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
    transform: [{ scale: flashScale.value }],
  }));

  return (
    <>
      <Animated.View style={[styles.centered, gemStyle]}>
        <Svg width={24} height={24} viewBox="0 0 24 24">
          {gem === "diamond" ? (
            <Polygon points="12,2 20,10 12,22 4,10" fill={fx.accent} stroke={fx.flash} strokeWidth={1.2} />
          ) : (
            <Polygon
              points="12,1 14.5,8 22,8.5 16,13.5 18,21 12,16.5 6,21 8,13.5 2,8.5 9.5,8"
              fill={fx.accent}
              stroke={fx.flash}
              strokeWidth={1}
            />
          )}
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, shardStyle]}>
        <Svg width={BASE} height={BASE} viewBox="0 0 60 60">
          <Polygon points="58,30 36,27 36,33" fill={fx.accent} />
          <Polygon points="44,54 32,38 36,36" fill={fx.accent} />
          <Polygon points="16,54 24,36 28,38" fill={fx.accent} />
          <Polygon points="2,30 24,27 24,33" fill={fx.accent} />
          <Polygon points="16,6 24,24 28,22" fill={fx.accent} />
          <Polygon points="44,6 32,22 36,24" fill={fx.accent} />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.centered, flashStyle]}>
        <View style={[styles.impactCircle, { backgroundColor: fx.flash }]} />
      </Animated.View>
    </>
  );
}

/**
 * Spades — a steel sword drops onto the target with a landing recoil and a
 * puff of impact dust; buffs add a shield that pulses in behind it.
 */
function SpadeSword({ delayMs, fx, withShield }: { delayMs: number; fx: Fx; withShield: boolean }) {
  const swordOpacity = useSharedValue(0);
  const swordDrop = useSharedValue(-64);
  const swordTilt = useSharedValue(-10);
  const dustOpacity = useSharedValue(0);
  const dustScale = useSharedValue(0.6);
  const shieldOpacity = useSharedValue(0);
  const shieldScale = useSharedValue(0.7);

  useEffect(() => {
    const total = withShield ? 1000 : 800;
    swordOpacity.value = withDelay(
      delayMs,
      withSequence(
        withTiming(1, { duration: 60 }),
        withTiming(1, { duration: total - 260 }),
        withTiming(0, { duration: 200 }),
      ),
    );
    swordDrop.value = withDelay(
      delayMs + 60,
      withSequence(
        withTiming(0, { duration: 160, easing: Easing.in(Easing.quad) }),
        withTiming(3, { duration: 60 }),
        withTiming(0, { duration: 60 }),
      ),
    );
    swordTilt.value = withDelay(delayMs + 60, withTiming(0, { duration: 160 }));
    dustOpacity.value = withDelay(
      delayMs + 220,
      withSequence(withTiming(0.9, { duration: 100 }), withTiming(0, { duration: 150 })),
    );
    dustScale.value = withDelay(delayMs + 220, withTiming(1.2, { duration: 250, easing: Easing.out(Easing.quad) }));
    if (withShield) {
      shieldOpacity.value = withDelay(
        delayMs + 420,
        withSequence(
          withTiming(1, { duration: 120 }),
          withTiming(1, { duration: 280 }),
          withTiming(0, { duration: 180 }),
        ),
      );
      shieldScale.value = withDelay(
        delayMs + 420,
        withSequence(
          withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
          withTiming(1.08, { duration: 120 }),
          withTiming(1, { duration: 100 }),
        ),
      );
    }
  }, []);

  const shieldStyle = useAnimatedStyle(() => ({
    opacity: shieldOpacity.value,
    transform: [{ scale: shieldScale.value }],
  }));
  const swordStyle = useAnimatedStyle(() => ({
    opacity: swordOpacity.value,
    transform: [{ translateY: swordDrop.value }, { rotate: `${swordTilt.value}deg` }],
  }));
  const dustStyle = useAnimatedStyle(() => ({
    opacity: dustOpacity.value,
    transform: [{ scale: dustScale.value }],
  }));

  return (
    <>
      {withShield && (
        <Animated.View style={[StyleSheet.absoluteFill, shieldStyle]}>
          <Svg width={BASE} height={BASE} viewBox="0 0 60 60">
            <Path
              d="M30 22 L44 27 V38 C44 47 30 53 30 53 C30 53 16 47 16 38 V27 Z"
              fill="rgba(13,13,13,0.6)"
              stroke={fx.accent}
              strokeWidth={2}
            />
          </Svg>
        </Animated.View>
      )}
      <Animated.View style={[StyleSheet.absoluteFill, swordStyle]}>
        <Svg width={BASE} height={BASE} viewBox="0 0 60 60">
          {/* pommel, grip, crossguard, tapered blade (tip down) */}
          <Circle cx={30} cy={4} r={2.5} fill="#C89B3C" />
          <Rect x={28} y={5} width={4} height={8} fill={fx.core} />
          <Rect x={20} y={12} width={20} height={4} rx={1.5} fill="#C89B3C" />
          <Polygon
            points="27,16 33,16 33,44 30,52 27,44"
            fill={fx.accent}
            stroke={fx.core}
            strokeWidth={1.5}
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, dustStyle]}>
        <Svg width={BASE} height={BASE} viewBox="0 0 60 60">
          <Path d="M20 52 Q14 48 12 42" stroke={fx.accent} strokeWidth={2} fill="none" strokeLinecap="round" />
          <Path d="M40 52 Q46 48 48 42" stroke={fx.accent} strokeWidth={2} fill="none" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: "50%",
    top: "50%",
  },
  stage: {
    position: "absolute",
    width: BASE,
    height: BASE,
  },
  centered: {
    position: "absolute",
    left: 0,
    top: 0,
    width: BASE,
    height: BASE,
    alignItems: "center",
    justifyContent: "center",
  },
  impactCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  glowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    opacity: 0.35,
  },
  bloomRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
  },
  destroyFlash: {
    position: "absolute",
    left: -8,
    top: -8,
    right: -8,
    bottom: -8,
    borderRadius: 16,
    backgroundColor: "rgba(229,57,53,0.2)",
  },
});
