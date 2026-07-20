import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Alert, ActivityIndicator, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useAuth as useClerkAuth } from "@clerk/clerk-expo";
import { useAuth } from "@/lib/auth";
import {
  useGetMatch,
  getGetMatchQueryKey,
  useRematchMatch,
  useGetMyMatches,
  getGetMyMatchesQueryKey,
} from "@workspace/api-client-react";
import Colors, { seatColorFor } from "@/constants/colors";
import { Gradients, Type } from "@/constants/theme";
import { Easings, useReduceMotion } from "@/lib/motion";
import { playGameSfx } from "@/lib/sfx";
import SanctumBackground from "@/components/game/SanctumBackground";

type PlayerSnapshot = { userId: string; displayName: string; seatIndex: number };

export default function GameOverScreen() {
  const { matchId, winnerUserId, players: playersParam } = useLocalSearchParams<{
    matchId: string;
    winnerUserId: string;
    players: string;
  }>();
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const wsRef = useRef<WebSocket | null>(null);
  const hasNavigatedRef = useRef(false);
  const baselineWaitingRef = useRef<Set<string> | null>(null);
  const [rematchRequested, setRematchRequested] = useState(false);

  // Parse the players snapshot baked into the route params — available immediately,
  // no API round-trip needed.
  const paramPlayers: PlayerSnapshot[] = React.useMemo(() => {
    if (!playersParam) return [];
    try {
      const parsed = JSON.parse(playersParam);
      if (Array.isArray(parsed)) return parsed as PlayerSnapshot[];
    } catch {
      // malformed param — fall through to empty
    }
    return [];
  }, [playersParam]);

  const goToWaitingRoom = (newMatchId: string, code?: string) => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    router.replace({
      pathname: "/(game)/waiting-room",
      params: code ? { matchId: newMatchId, inviteCode: code } : { matchId: newMatchId },
    });
  };

  const { data: matchData } = useGetMatch(matchId ?? "", {
    query: {
      queryKey: getGetMatchQueryKey(matchId ?? ""),
      enabled: !!matchId,
      refetchOnMount: "always",
      staleTime: 0,
    },
  });

  const { data: myMatchesData } = useGetMyMatches({
    query: {
      queryKey: getGetMyMatchesQueryKey(),
      enabled: !!matchId,
      refetchInterval: 2500,
    },
  });

  // Discover the rematch waiting room via the player's own open-matches list.
  // Catches every player the transient WS "rematch" message may miss.
  useEffect(() => {
    const matches = myMatchesData?.matches;
    if (!matches) return;

    const waitingIds = matches
      .filter((m) => m.status === "waiting")
      .map((m) => m.matchId);

    if (baselineWaitingRef.current === null) {
      // First load establishes the baseline of pre-existing waiting rooms.
      baselineWaitingRef.current = new Set(waitingIds);
      return;
    }

    const baseline = baselineWaitingRef.current;
    const fresh = matches
      .filter(
        (m) =>
          m.status === "waiting" &&
          m.matchId !== matchId &&
          !baseline.has(m.matchId),
      )
      // Deterministic tiebreak so all clients converge on the same room.
      .sort((a, b) => a.matchId.localeCompare(b.matchId));

    if (fresh.length > 0) {
      goToWaitingRoom(fresh[0].matchId, fresh[0].inviteCode);
    }
  }, [myMatchesData, matchId]);

  const { mutate: requestRematch, isPending: isRequestingRematch } = useRematchMatch({
    mutation: {
      onSuccess: (data) => {
        // Response carries no inviteCode; the waiting room resolves it from its own match poll.
        goToWaitingRoom(data.matchId);
      },
      onError: (err: unknown) => {
        setRematchRequested(false);
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
      const token = await getToken();
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
          if (msg.type === "rematch" && msg.matchId) {
            goToWaitingRoom(msg.matchId);
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

  // Prefer matchData players (richer / authoritative) once loaded; fall back to
  // the param snapshot that arrived instantly with the navigation.
  const mergedPlayers: PlayerSnapshot[] = React.useMemo(() => {
    if (matchData?.players?.length) {
      return matchData.players.map((p, i) => ({
        userId: p.userId,
        displayName: p.displayName,
        seatIndex: i,
      }));
    }
    return paramPlayers;
  }, [matchData?.players, paramPlayers]);

  const displayNames: Record<string, string> = {};
  for (const p of mergedPlayers) {
    displayNames[p.userId] = p.displayName;
  }

  const didWin = winnerUserId === user?.id;
  const winnerName = winnerUserId
    ? (displayNames[winnerUserId] ?? winnerUserId.slice(0, 8))
    : null;

  // One musical sting as the screen lands — triumphant or somber. Respects
  // the persisted mute setting inside playGameSfx.
  useEffect(() => {
    playGameSfx(didWin ? "fanfare" : "defeat");
  }, []);

  return (
    <View style={styles.container}>
      <SanctumBackground runeCenter={0.32} />
      {/* Win/lose mood wash over the sanctum. */}
      <LinearGradient
        colors={
          didWin
            ? (["transparent", "rgba(200,155,60,0.10)", "transparent"] as const)
            : (["transparent", "rgba(200,16,46,0.10)", "transparent"] as const)
        }
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {didWin && <VictoryMotes />}

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

          <View style={styles.playersList}>
            {mergedPlayers.length > 0 ? (
              mergedPlayers.map((p) => {
                const isWinner = p.userId === winnerUserId;
                const color = seatColorFor(p.seatIndex);
                return (
                  <View key={p.userId} style={[styles.playerRow, isWinner && styles.playerRowWinner]}>
                    <View style={[styles.playerDot, { backgroundColor: color }]} />
                    <Text style={styles.playerRowName} numberOfLines={1}>
                      {p.displayName || `Player ${p.seatIndex + 1}`}
                      {p.userId === user?.id ? <Text style={styles.youLabel}> (you)</Text> : ""}
                    </Text>
                    {isWinner && <Ionicons name="trophy" size={14} color={Colors.brand} />}
                  </View>
                );
              })
            ) : (
              [0, 1].map((i) => (
                <View key={i} style={[styles.playerRow, styles.playerRowSkeleton]}>
                  <View style={[styles.playerDot, styles.playerDotSkeleton]} />
                  <View style={styles.playerNameSkeleton} />
                </View>
              ))
            )}
          </View>

          <Text style={styles.matchIdText}>Match: {matchData?.match?.inviteCode ?? matchId}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.buttons}>
          <Pressable
            onPress={() => {
              if (!matchId || isRequestingRematch || rematchRequested) return;
              setRematchRequested(true);
              requestRematch({ matchId });
            }}
            disabled={isRequestingRematch || rematchRequested}
            style={({ pressed }) => [styles.playAgainBtn, pressed && { opacity: 0.8 }]}
          >
            <LinearGradient
              colors={Gradients.green}
              style={styles.playAgainGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isRequestingRematch || rematchRequested ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="refresh" size={20} color="#FFF" />
              )}
              <Text style={styles.playAgainText}>
                {isRequestingRematch || rematchRequested ? "Rematch requested…" : "Rematch"}
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

// Deterministic mote placements: horizontal position (fraction of width),
// stagger, size and drift speed. Eight is plenty — this loops forever.
const MOTES = [
  { x: 0.12, delay: 0, s: 5, dur: 5200 },
  { x: 0.25, delay: 900, s: 4, dur: 6100 },
  { x: 0.38, delay: 2000, s: 6, dur: 4800 },
  { x: 0.52, delay: 400, s: 4, dur: 5600 },
  { x: 0.63, delay: 1500, s: 5, dur: 5000 },
  { x: 0.75, delay: 2600, s: 4, dur: 6400 },
  { x: 0.86, delay: 700, s: 6, dur: 5400 },
  { x: 0.94, delay: 1900, s: 4, dur: 5900 },
];

/** Golden motes rising forever behind a victory — opacity/transform only. */
function VictoryMotes() {
  const reduceMotion = useReduceMotion();
  const { width, height } = useWindowDimensions();
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {MOTES.map((m, i) => (
        <RisingMote key={i} x={m.x * width} height={height} delay={m.delay} size={m.s} duration={m.dur} />
      ))}
    </View>
  );
}

function RisingMote({
  x,
  height,
  delay,
  size,
  duration,
}: {
  x: number;
  height: number;
  delay: number;
  size: number;
  duration: number;
}) {
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    ty.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-height * 0.85, { duration, easing: Easings.linear }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.7, { duration: duration * 0.15 }),
          withTiming(0.7, { duration: duration * 0.55 }),
          withTiming(0, { duration: duration * 0.3 }),
        ),
        -1,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: x,
          bottom: -size,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#FFD54F",
        },
        style,
      ]}
    />
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
    // Stretch to the full content width so full-width children (playersList)
    // don't collapse to a narrow box and truncate player names.
    alignSelf: "stretch",
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
    fontSize: 38,
    ...Type.display,
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
  playersList: {
    width: "100%",
    gap: 6,
    marginTop: 4,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  playerRowWinner: {
    borderColor: Colors.brand,
    backgroundColor: "rgba(200,155,60,0.08)",
  },
  playerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  playerRowName: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  youLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  playerRowSkeleton: {
    opacity: 0.5,
  },
  playerDotSkeleton: {
    backgroundColor: Colors.border,
  },
  playerNameSkeleton: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.border,
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
