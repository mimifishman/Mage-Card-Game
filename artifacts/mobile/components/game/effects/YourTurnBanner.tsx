import React, { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Easings, useReduceMotion } from "@/lib/motion";

// One-shot "YOUR TURN" proclamation in the player's seat color — scales in,
// holds a beat, fades. Mounted keyed on the turn change (like TurnFlare);
// purely decorative and self-hiding.
export default function YourTurnBanner({ color }: { color: string }) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0.7);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = withSequence(
        withTiming(1, { duration: 120 }),
        withTiming(1, { duration: 900 }),
        withTiming(0, { duration: 200 }),
      );
      return;
    }
    opacity.value = withSequence(
      withTiming(1, { duration: 160 }),
      withTiming(1, { duration: 850 }),
      withTiming(0, { duration: 350 }),
    );
    scale.value = withSequence(
      withTiming(1.06, { duration: 220, easing: Easings.out }),
      withTiming(1, { duration: 140 }),
      withTiming(1, { duration: 700 }),
      withTiming(0.96, { duration: 300 }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, style]}>
      <Text
        style={[
          styles.text,
          {
            color,
            textShadowColor: color,
          },
        ]}
      >
        YOUR TURN
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "30%",
    alignItems: "center",
  },
  text: {
    fontSize: 30,
    fontFamily: "Cinzel_700Bold",
    letterSpacing: 4,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
});
