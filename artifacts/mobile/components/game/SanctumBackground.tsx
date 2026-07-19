import React, { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line, Polygon } from "react-native-svg";
import Colors from "@/constants/colors";
import { Gradients } from "@/constants/theme";
import { Easings, useReduceMotion } from "@/lib/motion";

// ── The wizard's sanctum ─────────────────────────────────────────────────
// Layered, code-drawn backdrop behind every screen of the game:
//   obsidian gradient → still starfield → two drifting mist orbs → a slow
//   rune circle turning behind the board center.
// Entirely decorative: pointerEvents="none", opacity/transform animation
// only, a fixed handful of elements, and everything freezes under the OS
// Reduce Motion setting.

interface SanctumBackgroundProps {
  /** Vertical center of the rune circle as a fraction of screen height. */
  runeCenter?: number;
  /** Skip the rune circle entirely (menu screens want just stars + mist). */
  showRune?: boolean;
}

// Deterministic star placements (fraction of width/height) — no per-render
// randomness, so the sky is stable across re-renders.
const STARS = [
  { x: 0.08, y: 0.06, s: 2, o: 0.5 },
  { x: 0.22, y: 0.13, s: 1.5, o: 0.35 },
  { x: 0.37, y: 0.05, s: 2, o: 0.45 },
  { x: 0.55, y: 0.1, s: 1.5, o: 0.3 },
  { x: 0.7, y: 0.04, s: 2.5, o: 0.5 },
  { x: 0.86, y: 0.09, s: 1.5, o: 0.35 },
  { x: 0.94, y: 0.2, s: 2, o: 0.4 },
  { x: 0.12, y: 0.3, s: 1.5, o: 0.3 },
  { x: 0.45, y: 0.24, s: 2, o: 0.35 },
  { x: 0.8, y: 0.32, s: 1.5, o: 0.3 },
  { x: 0.05, y: 0.55, s: 2, o: 0.3 },
  { x: 0.93, y: 0.5, s: 1.5, o: 0.25 },
  { x: 0.25, y: 0.72, s: 1.5, o: 0.25 },
  { x: 0.68, y: 0.78, s: 2, o: 0.3 },
  { x: 0.9, y: 0.88, s: 1.5, o: 0.25 },
  { x: 0.15, y: 0.92, s: 2, o: 0.3 },
];

export default function SanctumBackground({
  runeCenter = 0.4,
  showRune = true,
}: SanctumBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={Gradients.sanctum} style={StyleSheet.absoluteFill} />

      {/* Still starfield */}
      {STARS.map((star, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: star.x * width,
            top: star.y * height,
            width: star.s,
            height: star.s,
            borderRadius: star.s / 2,
            backgroundColor: "#C8C8F0",
            opacity: star.o,
          }}
        />
      ))}

      {/* Drifting arcane mist */}
      <MistOrb
        color={Colors.arcane}
        size={width * 0.9}
        startX={-width * 0.35}
        startY={height * 0.08}
        driftX={width * 0.18}
        driftY={height * 0.05}
        duration={26000}
        reduceMotion={reduceMotion}
      />
      <MistOrb
        color={Colors.brandDim}
        size={width * 0.8}
        startX={width * 0.5}
        startY={height * 0.62}
        driftX={-width * 0.15}
        driftY={-height * 0.06}
        duration={34000}
        reduceMotion={reduceMotion}
      />

      {/* The rune circle, slowly turning behind the board */}
      {showRune && (
        <RuneCircle
          size={Math.min(width, height) * 0.85}
          centerX={width / 2}
          centerY={height * runeCenter}
          reduceMotion={reduceMotion}
        />
      )}
    </View>
  );
}

function MistOrb({
  color,
  size,
  startX,
  startY,
  driftX,
  driftY,
  duration,
  reduceMotion,
}: {
  color: string;
  size: number;
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  duration: number;
  reduceMotion: boolean;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      tx.value = 0;
      ty.value = 0;
      return;
    }
    tx.value = withRepeat(
      withSequence(
        withTiming(driftX, { duration, easing: Easings.inOut }),
        withTiming(0, { duration, easing: Easings.inOut }),
      ),
      -1,
    );
    ty.value = withRepeat(
      withSequence(
        withTiming(driftY, { duration: duration * 1.2, easing: Easings.inOut }),
        withTiming(0, { duration: duration * 1.2, easing: Easings.inOut }),
      ),
      -1,
    );
  }, [reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: startX,
          top: startY,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: 0.055,
        },
        style,
      ]}
    />
  );
}

function RuneCircle({
  size,
  centerX,
  centerY,
  reduceMotion,
}: {
  size: number;
  centerX: number;
  centerY: number;
  reduceMotion: boolean;
}) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    rotation.value = withRepeat(withTiming(360, { duration: 90000, easing: Easings.linear }), -1);
  }, [reduceMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Static SVG geometry: two rings, 12 tick marks, and four small sigil
  // diamonds at the cardinal points. Gold, very faint.
  const r = 100; // viewBox radius units
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return {
      x1: 110 + Math.cos(a) * (r - 8),
      y1: 110 + Math.sin(a) * (r - 8),
      x2: 110 + Math.cos(a) * (r - 16),
      y2: 110 + Math.sin(a) * (r - 16),
    };
  });
  const sigils = [0, 90, 180, 270].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return { cx: 110 + Math.cos(a) * (r - 30), cy: 110 + Math.sin(a) * (r - 30) };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: centerX - size / 2,
          top: centerY - size / 2,
          width: size,
          height: size,
        },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 220 220" opacity={0.09}>
        <Circle cx={110} cy={110} r={r} stroke={Colors.brand} strokeWidth={1.5} fill="none" />
        <Circle cx={110} cy={110} r={r - 22} stroke={Colors.brand} strokeWidth={0.8} fill="none" />
        <Circle
          cx={110}
          cy={110}
          r={r - 44}
          stroke={Colors.arcane}
          strokeWidth={0.8}
          fill="none"
          strokeDasharray="4 8"
        />
        {ticks.map((t, i) => (
          <Line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={Colors.brand}
            strokeWidth={1.2}
          />
        ))}
        {sigils.map((sg, i) => (
          <Polygon
            key={i}
            points={`${sg.cx},${sg.cy - 5} ${sg.cx + 5},${sg.cy} ${sg.cx},${sg.cy + 5} ${sg.cx - 5},${sg.cy}`}
            fill={Colors.arcane}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}
