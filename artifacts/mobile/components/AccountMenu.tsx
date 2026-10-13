import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useDeleteAccount } from "@workspace/api-client-react";
import Colors from "@/constants/colors";

const DELETE_TITLE = "Delete account?";
const DELETE_MESSAGE = "This deletes your account and game history. This cannot be undone.";

// react-native-web's Alert ignores buttons, so the web build falls back to the browser dialogs.
function confirmDestructive(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}

function showError(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

interface AccountMenuProps {
  visible: boolean;
  displayName: string;
  onClose: () => void;
  onSignOut: () => void;
  /** Called after the server deleted the account; the caller signs out and leaves. */
  onDeleted: () => void;
}

export function AccountMenu({ visible, displayName, onClose, onSignOut, onDeleted }: AccountMenuProps) {
  const [deleted, setDeleted] = useState(false);
  const { mutate: deleteAccount, isPending } = useDeleteAccount({
    mutation: {
      onSuccess: () => {
        setDeleted(true);
        onDeleted();
      },
      onError: (err) => {
        const message =
          (err as { data?: { error?: string } })?.data?.error ??
          "Something went wrong. Check your connection and try again.";
        showError("Could not delete account", message);
      },
    },
  });

  const busy = isPending || deleted;

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    confirmDestructive(DELETE_TITLE, DELETE_MESSAGE, "Delete", () => deleteAccount());
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} testID="account-menu-backdrop">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>

          <Pressable
            onPress={onSignOut}
            disabled={busy}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
            testID="account-sign-out"
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.rowText}>Sign out</Text>
          </Pressable>

          <Pressable
            onPress={handleDelete}
            disabled={busy}
            style={({ pressed }) => [styles.row, styles.deleteRow, pressed && { opacity: 0.7 }]}
            testID="account-delete"
          >
            {busy ? (
              <ActivityIndicator size="small" color={Colors.accentRedSoft} />
            ) : (
              <Ionicons name="trash-outline" size={20} color={Colors.accentRedSoft} />
            )}
            <Text style={[styles.rowText, styles.deleteText]}>Delete account</Text>
          </Pressable>
          <Text style={styles.hint}>Deletes your account and game history for good.</Text>

          <Pressable
            onPress={onClose}
            disabled={busy}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            testID="account-menu-close"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  name: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSurface,
  },
  rowText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  deleteRow: {
    borderColor: "rgba(229,72,77,0.4)",
    backgroundColor: "rgba(229,72,77,0.12)",
  },
  deleteText: {
    color: Colors.accentRedSoft,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: -4,
    marginLeft: 4,
  },
  closeBtn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  closeText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
});
