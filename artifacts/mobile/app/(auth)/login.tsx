import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
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
import * as WebBrowser from "expo-web-browser";
import { useOAuth, useSignIn, useSignUp } from "@clerk/clerk-expo";
import Colors from "@/constants/colors";
import { useAuth } from "@/lib/auth";

WebBrowser.maybeCompleteAuthSession();

type EmailScreen = "form" | "verify";

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
  const { startOAuthFlow: startGoogleFlow } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startAppleFlow } = useOAuth({ strategy: "oauth_apple" });
  const { signIn, setActive: setActiveSignIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setActiveSignUp, isLoaded: signUpLoaded } = useSignUp();
  const { isLoading: authIsLoading, fetchFailed, retryFetchUser } = useAuth();

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailScreen, setEmailScreen] = useState<EmailScreen>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  // Also wait for the auth bridge to resolve any cached Clerk session.
  // If authIsLoading is true, Clerk has a cached token but the internal user
  // hasn't been fetched yet — signIn/signUp will be undefined in that state.
  const isLoaded = signInLoaded && signUpLoaded && !authIsLoading;

  async function handleOAuth(provider: "google" | "apple") {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOauthLoading(provider);
    setErrorMsg(null);
    try {
      const startFlow = provider === "google" ? startGoogleFlow : startAppleFlow;
      const { createdSessionId, setActive } = await startFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.toLowerCase().includes("already sign")) {
        setErrorMsg(`${provider === "google" ? "Google" : "Apple"} sign-in failed. Try again.`);
      }
    } finally {
      setOauthLoading(null);
    }
  }

  async function handleEmailSubmit() {
    if (!signIn || !signUp) {
      setErrorMsg("Authentication not ready. Please reload the app and try again.");
      return;
    }
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter your email and password.");
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      let result = await signIn.create({ identifier: email.trim(), password });
      if (result.status === "needs_first_factor") {
        result = await signIn.attemptFirstFactor({ strategy: "password", password });
      }
      if (result.status === "complete") {
        await setActiveSignIn({ session: result.createdSessionId });
      } else {
        setErrorMsg(`Sign-in status: "${result.status}" — please screenshot this and report it.`);
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ code: string; message: string }> };
      const code = clerkErr.errors?.[0]?.code;
      if (code === "form_identifier_not_found" || code === "form_password_incorrect") {
        if (code === "form_identifier_not_found") {
          try {
            await signUp.create({ emailAddress: email.trim(), password });
            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
            setEmailScreen("verify");
          } catch (signUpErr: unknown) {
            const e = signUpErr as { errors?: Array<{ message: string }> };
            setErrorMsg(e.errors?.[0]?.message ?? "Failed to create account.");
          }
        } else {
          setErrorMsg("Incorrect password. Try again.");
        }
      } else {
        const e = err as { errors?: Array<{ message: string }> };
        setErrorMsg(e.errors?.[0]?.message ?? "Sign-in failed. Try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify() {
    if (!signUp || !setActiveSignUp) return;
    if (!code.trim()) {
      setErrorMsg("Please enter the verification code.");
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status === "complete") {
        await setActiveSignUp({ session: result.createdSessionId });
      } else {
        setErrorMsg("Verification incomplete. Please try again.");
      }
    } catch (err: unknown) {
      const e = err as { errors?: Array<{ message: string }> };
      setErrorMsg(e.errors?.[0]?.message ?? "Verification failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetEmailFlow() {
    setShowEmailForm(false);
    setEmailScreen("form");
    setEmail("");
    setPassword("");
    setCode("");
    setErrorMsg(null);
    setShowPassword(false);
  }

  return (
    <View style={styles.outerContainer}>
      {/* Background stays truly full-screen, outside any keyboard-avoiding layout */}
      <LinearGradient
        colors={["#0A0A0F", "#100C1C", "#0A0A0F"]}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.5, 1]}
      />
      <View style={[StyleSheet.absoluteFill, styles.orbContainer]} pointerEvents="none">
        <PulsingOrb size={300} delay={0} />
        <PulsingOrb size={200} delay={500} />
        <PulsingOrb size={100} delay={1000} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, { paddingTop: topInset + 60, paddingBottom: bottomInset + 40 }]}>
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

              {!isLoaded ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Colors.brand} />
                </View>
              ) : fetchFailed ? (
                <View style={styles.fetchFailedContainer}>
                  <Ionicons name="cloud-offline-outline" size={36} color={Colors.textMuted} />
                  <Text style={styles.fetchFailedTitle}>Couldn't reach the server</Text>
                  <Text style={styles.fetchFailedSubtitle}>
                    You're signed in but we couldn't load your profile. Check your connection and try again.
                  </Text>
                  <Pressable
                    onPress={retryFetchUser}
                    style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons name="refresh-outline" size={16} color="#0A0A0F" />
                    <Text style={styles.retryBtnText}>Try Again</Text>
                  </Pressable>
                </View>
              ) : !showEmailForm ? (
                <View style={styles.authButtons}>
                  <SocialButton
                    label="Continue with Google"
                    iconName="logo-google"
                    onPress={() => handleOAuth("google")}
                    loading={oauthLoading === "google"}
                    disabled={oauthLoading !== null}
                  />
                  {Platform.OS !== "android" && (
                    <SocialButton
                      label="Continue with Apple"
                      iconName="logo-apple"
                      onPress={() => handleOAuth("apple")}
                      loading={oauthLoading === "apple"}
                      disabled={oauthLoading !== null}
                    />
                  )}
                  <View style={styles.orRow}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>or</Text>
                    <View style={styles.orLine} />
                  </View>
                  <Pressable
                    onPress={() => {
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                      setShowEmailForm(true);
                      setErrorMsg(null);
                    }}
                    style={({ pressed }) => [styles.emailButton, pressed && { opacity: 0.7 }]}
                    testID="email-signin-button"
                  >
                    <Ionicons name="mail-outline" size={18} color={Colors.textSecondary} />
                    <Text style={styles.emailButtonText}>Continue with Email</Text>
                  </Pressable>

                  {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
                </View>
              ) : emailScreen === "form" ? (
                <View style={styles.emailForm}>
                  <Pressable
                    onPress={resetEmailFlow}
                    style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
                    <Text style={styles.backBtnText}>Back</Text>
                  </Pressable>

                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email address"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    editable={!isSubmitting}
                    testID="email-input"
                  />
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Password"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      editable={!isSubmitting}
                      onSubmitEditing={handleEmailSubmit}
                      returnKeyType="go"
                      testID="password-input"
                    />
                    <Pressable
                      onPress={() => setShowPassword((v) => !v)}
                      style={styles.eyeBtn}
                      hitSlop={12}
                    >
                      <Ionicons
                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={Colors.textMuted}
                      />
                    </Pressable>
                  </View>

                  {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

                  <Pressable
                    onPress={handleEmailSubmit}
                    disabled={isSubmitting}
                    style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
                    testID="submit-email-button"
                  >
                    <LinearGradient
                      colors={[Colors.brand, Colors.brandDim]}
                      style={styles.submitBtnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#0A0A0F" />
                      ) : (
                        <Text style={styles.submitBtnText}>Enter the Arena</Text>
                      )}
                    </LinearGradient>
                  </Pressable>

                  <Text style={styles.emailHint}>
                    New here? Enter your details and we'll create your account.
                  </Text>
                </View>
              ) : (
                <View style={styles.emailForm}>
                  <Pressable
                    onPress={() => { setEmailScreen("form"); setCode(""); setErrorMsg(null); }}
                    style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Ionicons name="arrow-back" size={18} color={Colors.textSecondary} />
                    <Text style={styles.backBtnText}>Back</Text>
                  </Pressable>

                  <Text style={styles.verifyTitle}>Check your inbox</Text>
                  <Text style={styles.verifySubtitle}>
                    We sent a 6-digit code to{"\n"}{email}
                  </Text>

                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    value={code}
                    onChangeText={setCode}
                    placeholder="000000"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    editable={!isSubmitting}
                    onSubmitEditing={handleVerify}
                    returnKeyType="go"
                    testID="verify-code-input"
                  />

                  {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

                  <Pressable
                    onPress={handleVerify}
                    disabled={isSubmitting}
                    style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
                    testID="submit-verify-button"
                  >
                    <LinearGradient
                      colors={[Colors.brand, Colors.brandDim]}
                      style={styles.submitBtnGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#0A0A0F" />
                      ) : (
                        <Text style={styles.submitBtnText}>Verify & Enter</Text>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function SocialButton({
  label,
  iconName,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  iconName: "logo-google" | "logo-apple";
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.socialButton,
        pressed && !disabled && { opacity: 0.8 },
        disabled && !loading && { opacity: 0.5 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={Colors.textPrimary} />
      ) : (
        <Ionicons name={iconName} size={20} color={Colors.textPrimary} />
      )}
      <Text style={styles.socialButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
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
    gap: 16,
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
    paddingVertical: 20,
  },
  fetchFailedContainer: {
    width: "100%",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  fetchFailedTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  fetchFailedSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    backgroundColor: Colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#0A0A0F",
  },
  authButtons: {
    width: "100%",
    gap: 12,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  socialButtonText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 2,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  orText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
  },
  emailButtonText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  emailForm: {
    width: "100%",
    gap: 12,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 4,
    marginBottom: 4,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textPrimary,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  passwordInput: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 12,
    backgroundColor: "transparent",
    paddingRight: 44,
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    padding: 4,
  },
  codeInput: {
    textAlign: "center",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: 12,
  },
  submitBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 4,
    shadowColor: Colors.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  submitBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#0A0A0F",
    letterSpacing: 0.5,
  },
  emailHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  verifyTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  verifySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#E53935",
    textAlign: "center",
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
