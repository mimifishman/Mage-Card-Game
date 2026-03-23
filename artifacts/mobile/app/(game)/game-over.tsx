import React from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import Colors from "@/constants/colors";

export default function GameOverScreen() {
  const { matchId, winnerUserId } = useLocalSearchParams<{
    matchId: string;
    winnerUserId: string;
  }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const didWin = winnerUserId === user?.id;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={didWin ? ["#0A0A0F", "#0C1A08", "#0A0A0F"] : ["#0A0A0F", "#1A080C", "#0A0A0F"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: topInset + 40, paddingBottom: bottomInset + 24 }]}>
        <Animated.View entering={FadeInDown.duration(600)} style={styles.centerBlock}>
          <View style={[styles.resultIcon, didWin ? styles.winIcon : styles.loseIcon]}>
            <Ionicons
              name={didWin ? "trophy" : "skull"}
              size={56}
              color={didWin ? Colors.brand : Colors.accentRed}
            />
          </View>

          <Text style={[styles.resultTitle, didWin ? styles.winTitle : styles.loseTitle]}>
            {didWin ? "Victory!" : "Defeated"}
          </Text>

          <Text style={styles.resultSub}>
            {didWin
              ? "You conquered all challengers."
              : winnerUserId
              ? "The game has ended."
              : "The match is over."}
          </Text>

          <Text style={styles.matchIdText}>Match: {matchId}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.buttons}>
          <Pressable
            onPress={() => router.replace("/(game)/lobby")}
            style={({ pressed }) => [styles.lobbyBtn, pressed && { opacity: 0.8 }]}
          >
            <LinearGradient
              colors={[Colors.brand, Colors.brandDim]}
              style={styles.lobbyBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="home" size={20} color={Colors.bgDeep} />
              <Text style={styles.lobbyBtnText}>Back to Lobby</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  centerBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  resultIcon: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 2,
  },
  winIcon: {
    backgroundColor: "rgba(200,155,60,0.12)",
    borderColor: Colors.brand,
  },
  loseIcon: {
    backgroundColor: "rgba(192,57,43,0.12)",
    borderColor: Colors.accentRed,
  },
  resultTitle: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  winTitle: {
    color: Colors.brand,
  },
  loseTitle: {
    color: Colors.accentRed,
  },
  resultSub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  matchIdText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: 8,
  },
  buttons: {
    width: "100%",
    gap: 12,
  },
  lobbyBtn: {
    borderRadius: 16,
    overflow: "hidden",
  },
  lobbyBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
  },
  lobbyBtnText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
  },
});
