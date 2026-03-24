import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const AUTH_TOKEN_KEY = "auth_session_token";

export async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(AUTH_TOKEN_KEY);
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export async function setStoredToken(token: string): Promise<void> {
  if (Platform.OS === "web") { localStorage.setItem(AUTH_TOKEN_KEY, token); return; }
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function deleteStoredToken(): Promise<void> {
  if (Platform.OS === "web") { localStorage.removeItem(AUTH_TOKEN_KEY); return; }
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}
