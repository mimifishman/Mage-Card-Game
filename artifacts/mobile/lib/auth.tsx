import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);

const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
  async clearToken(key: string) {
    return SecureStore.deleteItemAsync(key);
  },
};

interface User {
  id: string;
  displayName: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  fetchFailed: boolean;
  retryFetchUser: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  fetchFailed: false,
  retryFetchUser: () => {},
  logout: async () => {},
});

function getApiBaseUrl(): string {
  return domain ? `https://${domain}` : "";
}

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, signOut, getToken } = useClerkAuth();
  const [internalUser, setInternalUser] = useState<User | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  // isResolved: true once we've definitively determined auth state (signed-out,
  // or signed-in + internal user fetch finished — whether success or failure).
  const [isResolved, setIsResolved] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Use a ref so the token getter always reads the latest getToken without
  // adding it to effect deps (Clerk does not memoize getToken, causing loops).
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  });

  useEffect(() => {
    setAuthTokenGetter(() => getTokenRef.current());
    return () => {
      setAuthTokenGetter(null);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setInternalUser(null);
      setFetchFailed(false);
      setIsResolved(true);
      return;
    }

    // Signed in — fetch the internal user profile. Mark unresolved while fetching
    // so isLoading stays true and the app doesn't navigate prematurely.
    setIsResolved(false);
    setFetchFailed(false);
    let cancelled = false;

    async function fetchInternalUser() {
      try {
        const token = await getTokenRef.current();
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/api/auth/me`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            // Prevent 304 responses — React Native fetch does not transparently
            // return the cached body for 304s the way browsers do, so res.ok
            // would be false and internalUser would never be set.
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });
        if (!cancelled) {
          if (res.ok) {
            const data = (await res.json()) as { user?: { id: string; displayName: string } | null };
            if (data.user) {
              setInternalUser({ id: data.user.id, displayName: data.user.displayName });
            } else {
              setFetchFailed(true);
            }
          } else {
            console.warn("Failed to fetch internal user: HTTP", res.status);
            setFetchFailed(true);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Failed to fetch internal user:", err);
          setFetchFailed(true);
        }
      } finally {
        // Always resolve — even on failure — so isLoading becomes false and the
        // login screen becomes interactive instead of stuck indefinitely.
        if (!cancelled) setIsResolved(true);
      }
    }

    fetchInternalUser();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, retryCount]);

  const retryFetchUser = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: internalUser,
      // Loading until Clerk has resolved AND the internal user fetch has finished
      // (whether success or failure). This prevents the stuck-loading bug where
      // a failed /api/auth/me left isLoading permanently true.
      isLoading: !isResolved,
      isAuthenticated: !!isSignedIn && !!internalUser,
      fetchFailed,
      retryFetchUser,
      logout: async () => {
        setInternalUser(null);
        setIsResolved(false);
        await signOut();
      },
    }),
    [internalUser, isResolved, isSignedIn, fetchFailed, retryFetchUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
      proxyUrl={proxyUrl}
    >
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
