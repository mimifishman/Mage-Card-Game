import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Alert, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/lib/auth";
import { useGetMatch, getGetMatchQueryKey, useRematchMatch } from "@workspace/api-client-react";
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
  const wsRef = useRef<WebSocket | null>(null);

  const { data: matchData } = useGetMatch(matchId ?? "", {
    query: { queryKey: getGetMatchQueryKey(matchId ?? ""), enabled: !!matchId },
  });

  const { mutate: requestRematch, isPending: isRequestingRematch } = useRematchMatch({
    mutation: {
      onSuccess: () => {
        router.replace({
          pathname: "/(game)/waiting-room",
          params: { matchId },
        });
      },
      onError: (err: unknown) => {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? "Rematch failed";
        Alert.alert("Rematch Error", msg);
      },
    },
  });

  useEffect(() => {
    if (!matchId) return;
    let mounted = true;

    async function connect() {
      const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
      if (!domain) return;
      const token = await SecureStore.getItemAsync("auth_session_token");
      const wsUrl = `wss://${domain}/ws?matchId=${matchId}`;
      const protocols = token ? [`bearer-${token}`] : undefined;
      const ws = new WebSocket(wsUrl, protocols);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join_match", matchId }));
      };

      ws.onmessage = (event) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(event.data as string) as { type: string; matchId?: string };
          if (msg.type === "rematch" && msg.matchId === matchId) {
            router.replace({
              pathname: "/(game)/waiting-room",
              params: { matchId },
            });
          }
        } catch {
          // ignore parse errors
        }
      };
    }

    connect();
    return () => {
      mounted = false;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [matchId]);

  const displayNames: Record<string, string> = {};
  if (matchData?.players) {
    for (const p of matchData.players) {
      displayNames[p.userId] = p.displayName;
    }
  }

  const didWin = winnerUserId === user?.id;
  const winnerName = winnerUserId
    ? (displayNames[winnerUserId] ?? winnerUserId.slice(0, 8))
    : null;

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
              : winnerName
              ? `${winnerName} wins the match!`
              : "The match is over."}
          </Text>

          {!didWin && winnerName && (
            <View style={styles.winnerBadge}>
              <Ionicons name="trophy" size={14} color={Colors.brand} />
              <Text style={styles.winnerBadgeText}>{winnerName}</Text>
            </View>
          )}

          <Text style={styles.matchIdText}>Match: {matchId}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.buttons}>
          <Pressable
            onPress={() => {
              if (!matchId || isRequestingRematch) return;
              requestRematch({ matchId });
            }}
            disabled={isRequestingRematch}
            style={({ pressed }) => [styles.playAgainBtn, pressed && { opacity: 0.8 }]}
          >
            <LinearGradient
              colors={[Colors.accentGreen, "#1E8449"]}
              style={styles.playAgainGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isRequestingRematch ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="refresh" size={20} color="#FFF" />
              )}
              <Text style={styles.playAgainText}>
                {isRequestingRematch ? "Starting..." : "Rematch"}
              </Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(game)/lobby")}
            style={({ pressed }) => [styles.lobbyBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="home-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.lobbyBtnText}>Back to Lobby</Text>
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
  winnerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(200,155,60,0.1)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(200,155,60,0.3)",
  },
  winnerBadgeText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.brand,
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
  playAgainBtn: {
    borderRadius: 16,
    overflow: "hidden",
  },
  playAgainGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
  },
  playAgainText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
  lobbyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  lobbyBtnText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
});
