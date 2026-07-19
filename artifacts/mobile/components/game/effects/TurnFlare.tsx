import React, { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Easings, useReduceMotion } from "@/lib/motion";

// A single arcane sweep that plays once when the turn passes: a soft band of
// the incoming player's color washing down the board. Mount it keyed on the
// turn change; it fades itself out and stays invisible after.
export default function TurnFlare({ color }: { color: string }) {
  const { height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const ty = useSharedValue(-height * 0.35);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withSequence(
      withTiming(0.16, { duration: 140 }),
      withTiming(0.16, { duration: 320 }),
      withTiming(0, { duration: 260 }),
    );
    ty.value = withTiming(height * 1.05, { duration: 720, easing: Easings.inOut });
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.band, { height: height * 0.35 }, style]}>
      <LinearGradient
        colors={["transparent", color, "transparent"]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
});
