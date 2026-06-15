import React, {
  createContext,
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  logout: async () => {},
});

function getApiBaseUrl(): string {
  return domain ? `https://${domain}` : "";
}

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, signOut, getToken } = useClerkAuth();
  const [internalUser, setInternalUser] = useState<User | null>(null);
  const [isFetchingUser, setIsFetchingUser] = useState(false);

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
      return;
    }

    let cancelled = false;

    async function fetchInternalUser() {
      setIsFetchingUser(true);
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
        if (!cancelled && res.ok) {
          const data = (await res.json()) as { user?: { id: string; displayName: string } | null };
          if (data.user) {
            setInternalUser({ id: data.user.id, displayName: data.user.displayName });
          }
        }
      } catch (err) {
        if (!cancelled) console.warn("Failed to fetch internal user:", err);
      } finally {
        if (!cancelled) setIsFetchingUser(false);
      }
    }

    fetchInternalUser();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: internalUser,
      // Show loading while Clerk loads OR while we're resolving the internal
      // user for an already-signed-in Clerk session.
      isLoading: !isLoaded || Boolean(isSignedIn && !internalUser),
      isAuthenticated: !!isSignedIn && !!internalUser,
      logout: async () => {
        setInternalUser(null);
        await signOut();
      },
    }),
    [internalUser, isLoaded, isSignedIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
