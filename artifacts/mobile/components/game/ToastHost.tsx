import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import Colors from "@/constants/colors";

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "error" | "success";
}

interface ToastHostProps {
  toasts: Toast[];
}

const TONE_STYLES: Record<Toast["tone"], { bg: string; border: string; text: string }> = {
  info: { bg: "rgba(26,56,36,0.96)", border: Colors.borderLight, text: Colors.textPrimary },
  error: { bg: "rgba(58,16,22,0.96)", border: "#E53935", text: "#FFB4B4" },
  success: { bg: "rgba(18,48,26,0.96)", border: "#2E7D32", text: "#A8E6B0" },
};

/** Non-blocking feedback stack rendered just above the hand — replaces the
    old Alert.alert dialogs for rejected plays and game notices. */
export default function ToastHost({ toasts }: ToastHostProps) {
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="none" style={styles.host}>
      {toasts.map((t) => {
        const tone = TONE_STYLES[t.tone];
        return (
          <Animated.View
            key={t.id}
            entering={FadeInDown.duration(200)}
            exiting={FadeOut.duration(250)}
            style={[styles.toast, { backgroundColor: tone.bg, borderColor: tone.border }]}
          >
            <Text style={[styles.text, { color: tone.text }]}>{t.text}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 190,
    gap: 6,
    zIndex: 50,
    alignItems: "center",
  },
  toast: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxWidth: "100%",
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});
