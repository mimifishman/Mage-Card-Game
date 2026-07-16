import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Cinzel_600SemiBold, Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { CinzelDecorative_700Bold } from "@expo-google-fonts/cinzel-decorative";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/lib/auth";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

// expo-font's web implementation (fontfaceobserver) has a hardcoded 6s
// timeout for detecting when a @font-face has finished loading. On slow
// or proxied connections it can fire a rejected promise even after the
// font already loaded successfully via useFonts, producing an unhandled
// rejection that crashes the web preview with a red error overlay. This
// is cosmetic (worst case: a brief system-font fallback), so we swallow
// only this specific, known-benign rejection and let everything else
// surface normally. Native (iOS/Android) doesn't use this loading path
// and RN's `window` global has no `addEventListener`, so this must be
// gated on Platform.OS === "web", not just `typeof window`.
if (
  Platform.OS === "web" &&
  typeof window !== "undefined" &&
  typeof window.addEventListener === "function"
) {
  window.addEventListener("unhandledrejection", (event) => {
    const message =
      event.reason && typeof event.reason.message === "string"
        ? event.reason.message
        : "";
    if (message.includes("timeout exceeded")) {
      event.preventDefault();
    }
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
});

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(game)/lobby");
    }
  }, [isAuthenticated, isLoading, segments]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bgDeep },
        animation: "fade",
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(game)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Sanctum display faces: Cinzel for headings, Cinzel Decorative for the
    // wordmark and Royal ranks. Numerals/body stay Inter (see constants/theme.ts).
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    CinzelDecorative_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <RootLayoutNav />
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
