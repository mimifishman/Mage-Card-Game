import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

export default function MatchScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A0A0F", "#0C0D18"]} style={StyleSheet.absoluteFill} />
      <View style={[styles.content, { paddingTop: topInset + 40 }]}>
        <Ionicons name="flash" size={48} color={Colors.brand} />
        <Text style={styles.title}>Match Starting</Text>
        <Text style={styles.subtitle}>Game board coming in Task #5</Text>
        <Text style={styles.matchId}>Match: {matchId}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDeep },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  matchId: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
});
