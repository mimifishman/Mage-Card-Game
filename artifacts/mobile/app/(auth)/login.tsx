import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeInDown,
  FadeIn,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth";
import Colors from "@/constants/colors";

function PulsingOrb({ delay = 0, size = 80 }: { delay?: number; size?: number }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 2000 + delay, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000 + delay, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 2000 + delay }),
        withTiming(0.5, { duration: 2000 + delay }),
      ),
      -1,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: Colors.brand,
          position: "absolute",
        },
        style,
      ]}
    />
  );
}

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  const buttonScale = useSharedValue(1);
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handleLogin = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    buttonScale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 100 }),
    );
    await login();
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A0F", "#100C1C", "#0A0A0F"]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />

      <View style={[StyleSheet.absoluteFill, styles.orbContainer]}>
        <PulsingOrb size={300} delay={0} />
        <PulsingOrb size={200} delay={500} />
        <PulsingOrb size={100} delay={1000} />
      </View>

      <View
        style={[
          styles.content,
          { paddingTop: topInset + 60, paddingBottom: bottomInset + 40 },
        ]}
      >
        <Animated.View entering={FadeIn.duration(800)} style={styles.logoSection}>
          <View style={styles.iconRing}>
            <Ionicons name="flash" size={48} color={Colors.brand} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(700)} style={styles.titleSection}>
          <Text style={styles.title}>MAGE</Text>
          <Text style={styles.subtitle}>CARD GAME</Text>
          <View style={styles.divider} />
          <Text style={styles.tagline}>Command the arcane. Claim the throne.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500).duration(700)} style={styles.bottomSection}>
          <Text style={styles.hint}>2–4 Players · Multiplayer · Strategy</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.brand} />
              <Text style={styles.loadingText}>Authenticating...</Text>
            </View>
          ) : (
            <Animated.View style={buttonStyle}>
              <Pressable
                onPress={handleLogin}
                style={({ pressed }) => [
                  styles.loginButton,
                  pressed && styles.loginButtonPressed,
                ]}
                testID="login-button"
              >
                <LinearGradient
                  colors={[Colors.brand, Colors.brandDim]}
                  style={styles.loginButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="enter-outline" size={22} color="#0A0A0F" />
                  <Text style={styles.loginButtonText}>Enter the Arena</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          )}

          <View style={styles.featureRow}>
            {[
              { icon: "shield-checkmark-outline" as const, label: "Secure" },
              { icon: "people-outline" as const, label: "Multiplayer" },
              { icon: "trophy-outline" as const, label: "Ranked" },
            ].map(({ icon, label }) => (
              <View key={label} style={styles.featureItem}>
                <Ionicons name={icon} size={16} color={Colors.textSecondary} />
                <Text style={styles.featureLabel}>{label}</Text>
              </View>
            ))}
          </View>
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
  orbContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  logoSection: {
    alignItems: "center",
  },
  iconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: Colors.brand,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(200, 155, 60, 0.1)",
  },
  titleSection: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 56,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    letterSpacing: 16,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.brand,
    letterSpacing: 8,
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  tagline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  bottomSection: {
    gap: 20,
    alignItems: "center",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  loadingContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  loginButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  loginButtonPressed: {
    opacity: 0.85,
  },
  loginButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  loginButtonText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#0A0A0F",
    letterSpacing: 0.5,
  },
  featureRow: {
    flexDirection: "row",
    gap: 32,
    marginTop: 8,
  },
  featureItem: {
    alignItems: "center",
    gap: 4,
  },
  featureLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
});
