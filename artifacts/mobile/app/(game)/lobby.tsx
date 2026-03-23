import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth";
import Colors from "@/constants/colors";

export default function LobbyScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [inviteCode, setInviteCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);

  const createScale = useSharedValue(1);
  const joinScale = useSharedValue(1);

  const createStyle = useAnimatedStyle(() => ({ transform: [{ scale: createScale.value }] }));
  const joinStyle = useAnimatedStyle(() => ({ transform: [{ scale: joinScale.value }] }));

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const getApiBase = () => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return domain ? `https://${domain}` : "";
  };

  const getBearerHeader = async (): Promise<Record<string, string>> => {
    const { default: SecureStore } = await import("expo-secure-store");
    const token = await SecureStore.getItemAsync("auth_session_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleCreateMatch = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    createScale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 100 }),
    );
    setIsCreating(true);
    try {
      const headers = await getBearerHeader();
      const res = await fetch(`${getApiBase()}/api/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
      });
      if (!res.ok) {
        const err = await res.json();
        Alert.alert("Error", err.error ?? "Failed to create match");
        return;
      }
      const data = await res.json();
      router.push({
        pathname: "/(game)/waiting-room",
        params: { matchId: data.match.id, isHost: "true", inviteCode: data.match.inviteCode },
      });
    } catch (e) {
      Alert.alert("Error", "Could not reach server");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinMatch = async () => {
    if (!inviteCode.trim()) {
      Alert.alert("Enter Code", "Please enter an invite code");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsJoining(true);
    try {
      const headers = await getBearerHeader();
      const res = await fetch(`${getApiBase()}/api/matches/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
      });
      if (!res.ok) {
        const err = await res.json();
        Alert.alert("Error", err.error ?? "Failed to join match");
        return;
      }
      const data = await res.json();
      router.push({
        pathname: "/(game)/waiting-room",
        params: { matchId: data.match.id, isHost: "false", inviteCode: data.match.inviteCode },
      });
    } catch (e) {
      Alert.alert("Error", "Could not reach server");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A0F", "#0E0B18", "#0A0A0F"]}
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

      <View style={styles.body}>
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
                colors={["#1E1830", "#120F20"]}
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
                colors={["#1A1E30", "#0F1220"]}
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

        <Animated.View entering={FadeInDown.delay(400).duration(600)} style={styles.statsRow}>
          {[
            { label: "Cards", value: "108", icon: "layers-outline" as const },
            { label: "Players", value: "2–4", icon: "people-outline" as const },
            { label: "Rounds", value: "Varied", icon: "refresh-outline" as const },
          ].map(({ label, value, icon }) => (
            <View key={label} style={styles.statItem}>
              <Ionicons name={icon} size={18} color={Colors.brand} />
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: bottomInset + 16 }]}>
        <View style={styles.footerDivider} />
        <Text style={styles.footerText}>Command the arcane · Claim the throne</Text>
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
  body: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 32,
  },
  heroSection: {
    alignItems: "center",
    gap: 8,
  },
  heroTitle: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    letterSpacing: 4,
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
