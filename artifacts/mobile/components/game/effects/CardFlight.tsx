import React, { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import CardView from "../CardView";
import { parseCardId } from "@/lib/gameUtils";
import { SUIT_FX, type SuitFxKey } from "@/constants/colors";
import { Durations, Easings, useReduceMotion } from "@/lib/motion";

// ── Flying cards ─────────────────────────────────────────────────────────
// Purely-visual card flights layered over the board. The real game state is
// untouched — these are transient clones that arc across the screen when a
// spell is cast ("cast": hand → board) or an attack comes in ("incoming":
// board → your seat). The host expires each flight after it lands.

export interface CardFlightEvent {
  id: number;
  cardId: string;
  kind: "cast" | "incoming";
}

export const CARD_FLIGHT_TTL_MS = 950;

export function CardFlightHost({ flights }: { flights: CardFlightEvent[] }) {
  const reduceMotion = useReduceMotion();
  if (reduceMotion || flights.length === 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {flights.map((f, i) => (
        <FlyingCard key={f.id} event={f} stagger={i * 120} />
      ))}
    </View>
  );
}

function FlyingCard({ event, stagger }: { event: CardFlightEvent; stagger: number }) {
  const { width, height } = useWindowDimensions();
  const card = parseCardId(event.cardId);
  const suitKey: SuitFxKey = card.isJoker ? "JOKER" : (card.suit as SuitFxKey);
  const glow = SUIT_FX[suitKey]?.accent ?? SUIT_FX.JOKER.accent;

  const cast = event.kind === "cast";
  // cast: rise from just above the hand tray to the board center.
  // incoming: dive from the board center down toward my seat.
  const fromY = cast ? height * 0.32 : -height * 0.05;
  const toY = cast ? -height * 0.06 : height * 0.3;
  const arcX = (cast ? -1 : 1) * width * 0.06;

  const ty = useSharedValue(fromY);
  const tx = useSharedValue(0);
  const scale = useSharedValue(cast ? 1 : 0.9);
  const rot = useSharedValue(cast ? -6 : 8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const flight = { duration: Durations.cinematic, easing: Easings.arc } as const;
    opacity.value = withDelay(
      stagger,
      withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(1, { duration: Durations.cinematic - 90 }),
        withTiming(0, { duration: 200 }),
      ),
    );
    ty.value = withDelay(stagger, withTiming(toY, flight));
    tx.value = withDelay(stagger, withTiming(arcX, flight));
    scale.value = withDelay(stagger, withTiming(cast ? 0.82 : 1.05, flight));
    rot.value = withDelay(stagger, withTiming(0, flight));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotate: `${rot.value}deg` },
    ],
  }));

  return (
    <View style={styles.centerAnchor}>
      <Animated.View
        style={[
          style,
          {
            shadowColor: glow,
            shadowOpacity: 0.9,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 0 },
            elevation: 12,
          },
        ]}
      >
        <CardView cardId={event.cardId} size="md" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerAnchor: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
