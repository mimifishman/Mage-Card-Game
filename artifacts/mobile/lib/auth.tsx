import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { AUTH_TOKEN_KEY, getStoredToken, setStoredToken, deleteStoredToken } from "./token-storage";

WebBrowser.maybeCompleteAuthSession();

const ISSUER_URL = "https://replit.com/oidc";

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);
setAuthTokenGetter(getStoredToken);

interface User {
  id: string;
  displayName: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
});

function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  }
  return "";
}

function getClientId(): string {
  return process.env.EXPO_PUBLIC_REPL_ID ?? "";
}

function getRedirectUri(): string {
  const expoDomain = process.env.EXPO_PUBLIC_EXPO_DOMAIN;
  if (expoDomain && Platform.OS === "web") {
    return `https://${expoDomain}/`;
  }
  return AuthSession.makeRedirectUri();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const discovery = AuthSession.useAutoDiscovery(ISSUER_URL);
  const redirectUri = getRedirectUri();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: getClientId(),
      scopes: ["openid", "email", "profile", "offline_access"],
      redirectUri,
      prompt: AuthSession.Prompt.Login,
    },
    discovery,
  );

  const fetchUser = useCallback(async () => {
    try {
      const token = await getStoredToken();
      if (!token && Platform.OS !== "web") {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const apiBase = getApiBaseUrl();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${apiBase}/api/auth/me`, {
        headers,
        credentials: "include",
      });
      const data = await res.json();

      if (data.user) {
        setUser(data.user);
      } else {
        if (token) {
          await deleteStoredToken();
        }
        setUser(null);
      }
    } catch (err) {
      console.warn("fetchUser error:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const sessionToken = params.get("session_token");
        if (sessionToken) {
          await setStoredToken(sessionToken);
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
      await fetchUser();
    };
    init();
  }, [fetchUser]);

  useEffect(() => {
    if (response?.type !== "success" || !request?.codeVerifier) return;

    const { code, state } = response.params;

    (async () => {
      try {
        const apiBase = getApiBaseUrl();
        if (!apiBase) return;

        const exchangeRes = await fetch(`${apiBase}/api/mobile-auth/token-exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            code_verifier: request.codeVerifier,
            redirect_uri: redirectUri,
            state,
            nonce: (request as unknown as { nonce?: string }).nonce,
          }),
        });

        if (!exchangeRes.ok) return;

        const data = await exchangeRes.json();
        if (data.token) {
          await setStoredToken(data.token);
          setIsLoading(true);
          await fetchUser();
        }
      } catch (err) {
        console.error("Token exchange error:", err);
        setIsLoading(false);
      }
    })();
  }, [response, request, redirectUri, fetchUser]);

  const login = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        const apiBase = getApiBaseUrl();
        window.location.href = `${apiBase}/api/login?web_mobile=1`;
        return;
      }
      await promptAsync();
    } catch (err) {
      console.error("Login error:", err);
    }
  }, [promptAsync]);

  const logout = useCallback(async () => {
    try {
      const token = await getStoredToken();
      if (token) {
        const apiBase = getApiBaseUrl();
        await fetch(`${apiBase}/api/mobile-auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      console.warn("Logout API call failed:", err);
    } finally {
      await deleteStoredToken();
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: !!user, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
