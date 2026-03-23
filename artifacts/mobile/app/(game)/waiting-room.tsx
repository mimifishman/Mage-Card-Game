import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMatch,
  useStartMatch,
  getGetMatchQueryKey,
} from "@workspace/api-client-react";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth";

const PLAYER_TITLES = ["The Wanderer", "Archmage", "Stormcaller", "Shadowbinder"];

function getPlayerDisplayName(
  userId: string,
  myUserId: string | undefined,
  myDisplayName: string | undefined,
  turnOrder: number,
): string {
  if (userId === myUserId) return myDisplayName ?? "You";
  return PLAYER_TITLES[turnOrder] ?? `Player ${turnOrder + 1}`;
}

export default function WaitingRoomScreen() {
  const { matchId, isHost: isHostParam, inviteCode } = useLocalSearchParams<{
    matchId: string;
    isHost: string;
    inviteCode: string;
  }>();
  const isHost = isHostParam === "true";
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const [copied, setCopied] = useState(false);

  const pulseOpacity = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  const startBtnScale = useSharedValue(1);
  const startBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: startBtnScale.value }] }));

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 800 }),
        withTiming(1, { duration: 800 }),
      ),
      -1,
    );
  }, []);

  const { data: matchData, isLoading } = useGetMatch(matchId ?? "", {
    query: {
      queryKey: getGetMatchQueryKey(matchId ?? ""),
      refetchInterval: 3000,
      enabled: !!matchId,
    },
  });

  const players = matchData?.players ?? [];
  const matchStatus = matchData?.match?.status;

  useEffect(() => {
    if (matchStatus === "in_progress") {
      router.replace({ pathname: "/(game)/match", params: { matchId } });
    }
  }, [matchStatus, matchId]);

  useEffect(() => {
    if (!matchId) return;

    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    if (!domain) return;

    const setupWs = async () => {
      const token = await SecureStore.getItemAsync("auth_session_token");
      const wsUrl = `wss://${domain}/ws?matchId=${matchId}`;
      const protocols = token ? [`bearer-${token}`] : undefined;
      const ws = new WebSocket(wsUrl, protocols);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join_match", matchId }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (
            msg.type === "player_joined" ||
            msg.type === "game_state_update"
          ) {
            queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });
          } else if (
            msg.type === "game_started" ||
            msg.type === "match_started"
          ) {
            router.replace({ pathname: "/(game)/match", params: { matchId } });
          }
        } catch {}
      };

      ws.onerror = () => {};
      ws.onclose = () => {};
    };

    setupWs();

    return () => {
      wsRef.current?.close();
    };
  }, [matchId, queryClient]);

  const { mutate: startMatchMutate, isPending: isStarting } = useStartMatch({
    mutation: {
      onSuccess: () => {
        router.replace({ pathname: "/(game)/match", params: { matchId } });
      },
      onError: (err) => {
        const message = (err as { data?: { error?: string } })?.data?.error ?? "Failed to start match";
        Alert.alert("Error", message);
      },
    },
  });

  const handleStartGame = () => {
    if (players.length < 2) {
      Alert.alert("Not enough players", "Need at least 2 players to start.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startBtnScale.value = withSequence(
      withTiming(0.94, { duration: 100 }),
      withTiming(1, { duration: 100 }),
    );
    startMatchMutate({ matchId });
  };

  const handleCopyCode = () => {
    Haptics.selectionAsync();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const canStart = isHost && players.length >= 2 && players.length <= 4;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A0F", "#0C0D18", "#0A0A0F"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: topInset + 16 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Waiting Room</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.body}>
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.codeSection}>
          <Text style={styles.codeLabel}>Invite Code</Text>
          <Pressable
            onPress={handleCopyCode}
            style={({ pressed }) => [styles.codeCard, pressed && { opacity: 0.85 }]}
            testID="invite-code-display"
          >
            <LinearGradient
              colors={["#1E1830", "#12101E"]}
              style={styles.codeGradient}
            >
              <Text style={styles.codeText}>{inviteCode}</Text>
              <View style={styles.copyBtn}>
                <Ionicons
                  name={copied ? "checkmark" : "copy-outline"}
                  size={18}
                  color={copied ? Colors.accentGreen : Colors.textSecondary}
                />
              </View>
            </LinearGradient>
          </Pressable>
          <Text style={styles.codeHint}>Share this code with friends</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.playersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Players</Text>
            <View style={styles.playerCount}>
              <Animated.View style={[styles.liveDot, pulseStyle]} />
              <Text style={styles.playerCountText}>{players.length} / 4</Text>
            </View>
          </View>

          {isLoading && players.length === 0 ? (
            <ActivityIndicator color={Colors.brand} style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.playersGrid}>
              {Array.from({ length: 4 }).map((_, idx) => {
                const player = players[idx];
                const isMe = player?.userId === user?.id;
                const displayName = player
                  ? getPlayerDisplayName(player.userId, user?.id, user?.displayName, idx)
                  : null;

                return (
                  <Animated.View
                    key={idx}
                    entering={FadeInDown.delay(300 + idx * 80).duration(500)}
                    style={[
                      styles.playerSlot,
                      player ? styles.playerSlotFilled : styles.playerSlotEmpty,
                    ]}
                  >
                    {player ? (
                      <>
                        <View style={[styles.playerAvatar, isMe && styles.playerAvatarMe]}>
                          <MaterialCommunityIcons
                            name="account-circle"
                            size={28}
                            color={isMe ? Colors.brand : Colors.textSecondary}
                          />
                        </View>
                        <Text
                          style={[styles.playerName, isMe && { color: Colors.brand }]}
                          numberOfLines={1}
                        >
                          {displayName}
                        </Text>
                        <View style={styles.badgeRow}>
                          {isMe && <Text style={styles.youBadge}>You</Text>}
                          {idx === 0 && <Text style={styles.hostBadge}>Host</Text>}
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.emptySlot}>
                          <Ionicons name="add" size={24} color={Colors.textMuted} />
                        </View>
                        <Text style={styles.emptySlotText}>Waiting...</Text>
                      </>
                    )}
                  </Animated.View>
                );
              })}
            </View>
          )}

          {players.length < 2 && (
            <View style={styles.waitingRow}>
              <ActivityIndicator size="small" color={Colors.textMuted} />
              <Text style={styles.waitingText}>Waiting for more players...</Text>
            </View>
          )}
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: bottomInset + 16 }]}>
        {isHost ? (
          <Animated.View style={[styles.startBtnWrapper, startBtnStyle]}>
            <Pressable
              onPress={handleStartGame}
              disabled={!canStart || isStarting}
              style={({ pressed }) => [
                styles.startBtn,
                !canStart && styles.startBtnDisabled,
                pressed && canStart && { opacity: 0.85 },
              ]}
              testID="start-game-button"
            >
              {isStarting ? (
                <View style={styles.loadingBtn}>
                  <ActivityIndicator color={Colors.bgDeep} />
                </View>
              ) : (
                <LinearGradient
                  colors={canStart ? [Colors.brand, Colors.brandDim] : [Colors.bgSurface, Colors.bgCard]}
                  style={styles.startBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="flash" size={22} color={canStart ? Colors.bgDeep : Colors.textMuted} />
                  <Text style={[styles.startBtnText, !canStart && { color: Colors.textMuted }]}>
                    {canStart
                      ? "Start Game"
                      : `Need ${Math.max(0, 2 - players.length)} more player${players.length === 1 ? "" : "s"}`}
                  </Text>
                </LinearGradient>
              )}
            </Pressable>
          </Animated.View>
        ) : (
          <View style={styles.waitingBanner}>
            <ActivityIndicator size="small" color={Colors.brand} />
            <Text style={styles.waitingBannerText}>Waiting for host to start...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 28,
  },
  codeSection: {
    alignItems: "center",
    gap: 10,
  },
  codeLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  codeCard: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  codeText: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: Colors.brand,
    letterSpacing: 8,
  },
  copyBtn: {
    padding: 8,
  },
  codeHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  playersSection: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  playerCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accentGreen,
  },
  playerCountText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  playersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  playerSlot: {
    width: "47%",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    minHeight: 120,
    justifyContent: "center",
  },
  playerSlotFilled: {
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
  },
  playerSlotEmpty: {
    backgroundColor: "transparent",
    borderColor: Colors.border,
    borderStyle: "dashed",
  },
  playerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  playerAvatarMe: {
    backgroundColor: "rgba(200,155,60,0.15)",
    borderWidth: 1,
    borderColor: Colors.brand,
  },
  playerName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 4,
  },
  youBadge: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.brand,
    backgroundColor: "rgba(200,155,60,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  hostBadge: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    backgroundColor: Colors.bgSurface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  emptySlot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
  },
  emptySlotText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  waitingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 4,
  },
  waitingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  footer: {
    paddingHorizontal: 24,
  },
  startBtnWrapper: {
    width: "100%",
  },
  startBtn: {
    borderRadius: 16,
    overflow: "hidden",
  },
  startBtnDisabled: {
    opacity: 1,
  },
  startBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
  },
  loadingBtn: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bgSurface,
  },
  startBtnText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
  },
  waitingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 18,
  },
  waitingBannerText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
});
