import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCreateMatch, useJoinMatch, useGetMyMatches, useAbandonMatch, getGetMyMatchesQueryKey } from "@workspace/api-client-react";
import type { MyMatchItem } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import Colors from "@/constants/colors";
import { Gradients } from "@/constants/theme";

export default function LobbyScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inviteCode, setInviteCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  const createScale = useSharedValue(1);
  const joinScale = useSharedValue(1);
  const createStyle = useAnimatedStyle(() => ({ transform: [{ scale: createScale.value }] }));
  const joinStyle = useAnimatedStyle(() => ({ transform: [{ scale: joinScale.value }] }));

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: myMatchesData, refetch: refetchMyMatches } = useGetMyMatches({
    query: {
      queryKey: getGetMyMatchesQueryKey(),
      refetchInterval: 5000,
    },
  });
  const myMatches = myMatchesData?.matches ?? [];

  useFocusEffect(
    useCallback(() => {
      refetchMyMatches();
    }, [refetchMyMatches]),
  );

  const { mutate: createMatch, isPending: isCreating } = useCreateMatch({
    mutation: {
      onSuccess: (data) => {
        router.push({
          pathname: "/(game)/waiting-room",
          params: {
            matchId: data.match.id,
            inviteCode: data.match.inviteCode,
          },
        });
      },
      onError: (err) => {
        const message = (err as { data?: { error?: string } })?.data?.error ?? "Failed to create match";
        Alert.alert("Error", message);
      },
    },
  });

  const { mutate: joinMatch, isPending: isJoining } = useJoinMatch({
    mutation: {
      onSuccess: (data) => {
        if (data.match.status === "in_progress") {
          router.push({
            pathname: "/(game)/match",
            params: { matchId: data.match.id },
          });
        } else {
          router.push({
            pathname: "/(game)/waiting-room",
            params: {
              matchId: data.match.id,
              inviteCode: data.match.inviteCode,
            },
          });
        }
      },
      onError: (err) => {
        const message = (err as { data?: { error?: string } })?.data?.error ?? "Failed to join match";
        Alert.alert("Error", message);
      },
    },
  });

  const handleCreateMatch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createScale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 100 }),
    );
    createMatch();
  };

  const handleJoinMatch = () => {
    if (!inviteCode.trim()) {
      Alert.alert("Enter Code", "Please enter an invite code");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    joinMatch({ data: { inviteCode: inviteCode.trim().toUpperCase() } });
  };

  const handleResume = (match: MyMatchItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (match.status === "in_progress") {
      router.push({
        pathname: "/(game)/match",
        params: { matchId: match.matchId },
      });
    } else {
      router.push({
        pathname: "/(game)/waiting-room",
        params: { matchId: match.matchId, inviteCode: match.inviteCode },
      });
    }
  };

  const { mutate: abandonMatch, isPending: isEnding, variables: endingVars } = useAbandonMatch({
    mutation: {
      onSuccess: () => {
        refetchMyMatches();
      },
      onError: (err) => {
        const message = (err as { data?: { error?: string } })?.data?.error ?? "Failed to end match";
        Alert.alert("Error", message);
      },
    },
  });

  const handleEndMatch = (match: MyMatchItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "End Match",
      "This will end the match for all players. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Match",
          style: "destructive",
          onPress: () => abandonMatch({ matchId: match.matchId }),
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={Gradients.sanctum}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: topInset + 16 }]}>
        <View>
          <Text style={styles.welcomeLabel}>Welcome back</Text>
          <Text style={styles.playerName}>{user?.displayName ?? "Mage"}</Text>
        </View>
        <Pressable
          onPress={logout}
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.6 }]}
          testID="logout-button"
        >
          <Ionicons name="log-out-outline" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.heroSection}>
          <MaterialCommunityIcons name="cards" size={48} color={Colors.brand} />
          <Text style={styles.heroTitle}>Arena</Text>
          <Text style={styles.heroSubtitle}>Choose your path to glory</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(600)} style={styles.cardsRow}>
          <Animated.View style={[styles.actionCard, createStyle]}>
            <Pressable
              onPress={handleCreateMatch}
              disabled={isCreating}
              style={({ pressed }) => [styles.actionCardInner, pressed && { opacity: 0.85 }]}
              testID="create-match-button"
            >
              <LinearGradient
                colors={Gradients.panelRaised}
                style={styles.actionCardGradient}
              >
                <View style={[styles.actionIconBg, { backgroundColor: "rgba(200,155,60,0.15)" }]}>
                  {isCreating ? (
                    <ActivityIndicator color={Colors.brand} size="small" />
                  ) : (
                    <Ionicons name="add-circle" size={32} color={Colors.brand} />
                  )}
                </View>
                <Text style={styles.actionTitle}>Create</Text>
                <Text style={styles.actionDesc}>Host a new match and invite friends</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          <Animated.View style={[styles.actionCard, joinStyle]}>
            <Pressable
              onPress={() => {
                joinScale.value = withSequence(
                  withTiming(0.95, { duration: 100 }),
                  withTiming(1, { duration: 100 }),
                );
                Haptics.selectionAsync();
                setShowJoinInput(!showJoinInput);
              }}
              style={({ pressed }) => [styles.actionCardInner, pressed && { opacity: 0.85 }]}
              testID="join-match-button"
            >
              <LinearGradient
                colors={Gradients.panel}
                style={styles.actionCardGradient}
              >
                <View style={[styles.actionIconBg, { backgroundColor: "rgba(41,128,185,0.15)" }]}>
                  <Ionicons name="enter" size={32} color={Colors.accentBlue} />
                </View>
                <Text style={[styles.actionTitle, { color: Colors.accentBlue }]}>Join</Text>
                <Text style={styles.actionDesc}>Enter a code to join a match</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </Animated.View>

        {showJoinInput && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.joinInputSection}>
            <View style={styles.joinInputWrapper}>
              <TextInput
                style={styles.joinInput}
                value={inviteCode}
                onChangeText={(t) => setInviteCode(t.toUpperCase())}
                placeholder="INVITE CODE"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                maxLength={8}
                returnKeyType="go"
                onSubmitEditing={handleJoinMatch}
                autoFocus
                testID="invite-code-input"
              />
            </View>
            <Pressable
              onPress={handleJoinMatch}
              disabled={isJoining}
              style={({ pressed }) => [styles.joinBtn, pressed && { opacity: 0.85 }]}
              testID="confirm-join-button"
            >
              {isJoining ? (
                <ActivityIndicator color="#0A0A0F" size="small" />
              ) : (
                <>
                  <Text style={styles.joinBtnText}>Join Match</Text>
                  <Ionicons name="arrow-forward" size={18} color="#0A0A0F" />
                </>
              )}
            </Pressable>
          </Animated.View>
        )}

        {myMatches.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.myMatchesSection}>
            <Text style={styles.myMatchesTitle}>Your Matches</Text>
            {myMatches.map((match) => (
              <View key={match.matchId} style={styles.matchCard} testID={`my-match-card-${match.matchId}`}>
                <View style={styles.matchCardLeft}>
                  <View style={styles.matchCardHeader}>
                    <Text style={styles.matchCode}>Match {match.inviteCode}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        match.status === "in_progress" ? styles.statusInProgress : styles.statusWaiting,
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {match.status === "in_progress" ? "In Progress" : "Waiting"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.matchPlayerNames} numberOfLines={1}>
                    {match.playerNames.length > 0 ? match.playerNames.join(" · ") : `${match.playerCount} player${match.playerCount === 1 ? "" : "s"}`}
                  </Text>
                </View>
                <View style={styles.matchCardActions}>
                  <Pressable
                    onPress={() => handleEndMatch(match)}
                    disabled={isEnding && endingVars?.matchId === match.matchId}
                    style={({ pressed }) => [styles.endMatchBtn, pressed && { opacity: 0.7 }]}
                    testID={`end-match-${match.matchId}`}
                  >
                    {isEnding && endingVars?.matchId === match.matchId ? (
                      <ActivityIndicator size="small" color={Colors.accentRed} />
                    ) : (
                      <Ionicons name="close" size={16} color={Colors.accentRed} />
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => handleResume(match)}
                    style={({ pressed }) => [styles.resumeBtn, pressed && { opacity: 0.8 }]}
                    testID={`resume-match-${match.matchId}`}
                  >
                    <Ionicons name="play" size={14} color="#0A0A0F" />
                    <Text style={styles.resumeBtnText}>Resume</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        <View style={[styles.footer, { paddingBottom: bottomInset + 16 }]}>
          <View style={styles.footerDivider} />
          <Text style={styles.footerText}>Command the arcane · Claim the throne</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  welcomeLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  playerName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
  },
  scrollBody: {
    flex: 1,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 32,
    paddingVertical: 24,
  },
  heroSection: {
    alignItems: "center",
    gap: 8,
  },
  heroTitle: {
    fontSize: 34,
    fontFamily: "Cinzel_700Bold",
    color: Colors.textPrimary,
    letterSpacing: 4,
    textShadowColor: "rgba(200,155,60,0.4)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
    marginTop: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 16,
  },
  actionCard: {
    flex: 1,
  },
  actionCardInner: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionCardGradient: {
    padding: 20,
    gap: 12,
    minHeight: 160,
    justifyContent: "center",
  },
  actionIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.brand,
  },
  actionDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  joinInputSection: {
    gap: 12,
  },
  joinInputWrapper: {
    borderWidth: 1,
    borderColor: Colors.accentBlue,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    overflow: "hidden",
  },
  joinInput: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    letterSpacing: 6,
    textAlign: "center",
  },
  joinBtn: {
    backgroundColor: Colors.accentBlue,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  joinBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#0A0A0F",
  },
  myMatchesSection: {
    gap: 10,
  },
  myMatchesTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  matchCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  matchCardLeft: {
    gap: 4,
    flex: 1,
    marginRight: 12,
  },
  matchCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  matchCode: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  matchPlayerNames: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusWaiting: {
    backgroundColor: "rgba(200,155,60,0.18)",
  },
  statusInProgress: {
    backgroundColor: "rgba(41,185,128,0.18)",
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  matchPlayerCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  matchCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  endMatchBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(229,72,77,0.4)",
    backgroundColor: "rgba(229,72,77,0.12)",
  },
  resumeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.brand,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resumeBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#0A0A0F",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 20,
  },
  statItem: {
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  footer: {
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 12,
  },
  footerDivider: {
    width: 40,
    height: 1,
    backgroundColor: Colors.border,
  },
  footerText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
});
