import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PublicPlayerState, RoyalInCourt } from "@workspace/api-client-react";
import { parseCardId, getValidActionsForCard } from "@/lib/gameUtils";
import type { ValidAction } from "@/lib/gameUtils";
import CardView from "./CardView";
import CourtZone from "./CourtZone";
import Colors from "@/constants/colors";

interface CardActionSheetProps {
  cardId: string | null;
  phase: string;
  isMyTurn: boolean;
  myCourt: RoyalInCourt[];
  allPlayers: Record<string, PublicPlayerState>;
  myPlayerId: string;
  myVault: number;
  isPending: boolean;
  hasTakenDiamondAction?: boolean;
  onClose: () => void;
  onAction: (params: ActionParams) => void;
}

export interface ActionParams {
  cardId: string;
  action: string;
  targetRoyalId?: string;
  targetPlayerId?: string;
  mode?: string;
}

type SheetStep = "actions" | "pick_royal" | "pick_player" | "joker_mode";

export default function CardActionSheet({
  cardId,
  phase,
  isMyTurn,
  myCourt,
  allPlayers,
  myPlayerId,
  myVault,
  isPending,
  hasTakenDiamondAction = false,
  onClose,
  onAction,
}: CardActionSheetProps) {
  const [step, setStep] = useState<SheetStep>("actions");
  const [chosenAction, setChosenAction] = useState<ValidAction | null>(null);
  const [jokerMode, setJokerMode] = useState<"destroy_royal" | "damage_player" | null>(null);

  if (!cardId) return null;

  const card = parseCardId(cardId);
  const validActions = getValidActionsForCard(
    card,
    phase,
    isMyTurn,
    myCourt.length,
    myVault,
    hasTakenDiamondAction,
  );

  const handleActionPick = (action: ValidAction) => {
    setChosenAction(action);
    if (card.isJoker) {
      setStep("joker_mode");
    } else if (action.requiresTarget) {
      if (action.targetType === "own_royal") {
        setStep("pick_royal");
      } else if (action.targetType === "any_royal" || action.targetType === "any_player") {
        setStep("pick_player");
      }
    } else {
      onAction({ cardId, action: action.action });
    }
  };

  const handleJokerMode = (mode: "destroy_royal" | "damage_player") => {
    setJokerMode(mode);
    if (mode === "destroy_royal") {
      setStep("pick_player");
    } else {
      setStep("pick_player");
    }
  };

  const handleRoyalTarget = (targetRoyalId: string) => {
    if (!chosenAction) return;
    onAction({ cardId, action: chosenAction.action, targetRoyalId });
  };

  const handlePlayerTarget = (targetPlayerId: string, targetRoyalId?: string) => {
    if (!chosenAction) return;
    if (card.isJoker) {
      onAction({
        cardId,
        action: chosenAction.action,
        targetPlayerId,
        targetRoyalId,
        mode: jokerMode ?? "damage_player",
      });
    } else if (chosenAction.action === "apply_club") {
      if (targetRoyalId) {
        onAction({ cardId, action: "apply_club", targetPlayerId, targetRoyalId });
      } else {
        onAction({ cardId, action: "apply_club", targetPlayerId });
      }
    } else if (chosenAction.action === "apply_club_damage") {
      onAction({ cardId, action: "apply_club_damage", targetPlayerId });
    }
  };

  const opponents = Object.values(allPlayers).filter((p) => p.id !== myPlayerId && !p.isEliminated);

  return (
    <Modal
      animationType="slide"
      transparent
      visible={!!cardId}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handleBar} />

          <View style={styles.header}>
            <Pressable onPress={step !== "actions" ? () => setStep("actions") : onClose} style={styles.backBtn}>
              <Ionicons
                name={step !== "actions" ? "chevron-back" : "close"}
                size={22}
                color={Colors.textSecondary}
              />
            </Pressable>
            <View style={styles.cardPreview}>
              <CardView cardId={cardId} size="md" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>
                {card.displayRank} {card.suitSymbol} {card.displaySuit}
              </Text>
              {card.isJoker && (
                <Text style={styles.cardSub}>Cost: 10 Vault</Text>
              )}
              {card.isRoyal && (
                <Text style={styles.cardSub}>Royal — costs 0 Vault</Text>
              )}
              {!card.isRoyal && !card.isJoker && card.suit !== "D" && (
                <Text style={styles.cardSub}>Vault cost: {card.vaultCost}</Text>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {isPending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.brand} />
              <Text style={styles.loadingText}>Applying action...</Text>
            </View>
          ) : step === "actions" ? (
            <ScrollView contentContainerStyle={styles.actionList}>
              {validActions.length === 0 ? (
                <Text style={styles.noActions}>
                  {!isMyTurn
                    ? "Wait for your turn to play cards."
                    : phase !== "main"
                    ? `Cannot play cards during ${phase} phase.`
                    : "No valid actions for this card."}
                </Text>
              ) : (
                validActions.map((va, i) => (
                  <Pressable
                    key={`${va.action}-${i}`}
                    onPress={() => !va.disabled && handleActionPick(va)}
                    disabled={va.disabled}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      va.disabled && styles.actionBtnDisabled,
                      pressed && !va.disabled && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.actionLabel, va.disabled && styles.actionLabelDisabled]}>
                      {va.label}
                    </Text>
                    {va.requiresTarget && !va.disabled && (
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>
          ) : step === "joker_mode" ? (
            <ScrollView contentContainerStyle={styles.actionList}>
              <Text style={styles.stepTitle}>Choose Joker Mode</Text>
              <Pressable
                onPress={() => handleJokerMode("destroy_royal")}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.actionLabel}>Destroy a Royal (pick opponent)</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={() => handleJokerMode("damage_player")}
                style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.actionLabel}>Deal 10 damage to a player</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </Pressable>
            </ScrollView>
          ) : step === "pick_royal" ? (
            <ScrollView contentContainerStyle={styles.targetList}>
              <Text style={styles.stepTitle}>Pick a Royal in your Court</Text>
              <CourtZone
                court={myCourt}
                size="md"
                onRoyalPress={handleRoyalTarget}
              />
            </ScrollView>
          ) : step === "pick_player" ? (
            <ScrollView contentContainerStyle={styles.targetList}>
              <Text style={styles.stepTitle}>
                {jokerMode === "destroy_royal" || chosenAction?.action === "apply_club"
                  ? "Pick an opponent"
                  : "Pick a target player"}
              </Text>
              {opponents.map((opp) => (
                <View key={opp.id} style={styles.oppSection}>
                  {jokerMode === "damage_player" || chosenAction?.action === "apply_club_damage" ? (
                    <Pressable
                      onPress={() => handlePlayerTarget(opp.id)}
                      style={({ pressed }) => [styles.oppBtn, pressed && { opacity: 0.75 }]}
                    >
                      <Text style={styles.oppName}>🎯 {opp.id.slice(0, 8)}</Text>
                      <Text style={styles.oppLife}>♥ {opp.life}</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.oppBtn}>
                      <Text style={styles.oppName}>🎯 {opp.id.slice(0, 8)}</Text>
                      <Text style={styles.oppLife}>♥ {opp.life}</Text>
                    </View>
                  )}
                  {(jokerMode === "destroy_royal" || chosenAction?.action === "apply_club") &&
                    opp.court.length > 0 ? (
                      <View style={styles.oppCourt}>
                        <Text style={styles.courtHint}>→ pick a Royal to target:</Text>
                        <CourtZone
                          court={opp.court}
                          size="sm"
                          onRoyalPress={(royalId) => handlePlayerTarget(opp.id, royalId)}
                        />
                      </View>
                    ) : (jokerMode === "destroy_royal" || chosenAction?.action === "apply_club") &&
                    opp.court.length === 0 ? (
                      <Text style={styles.courtHint}>  No royals in court — cannot target</Text>
                    ) : null}
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    maxHeight: "75%",
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  cardPreview: {},
  cardInfo: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  actionList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.bgSurface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnDisabled: {
    opacity: 0.5,
    borderColor: "transparent",
  },
  actionLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textPrimary,
    flex: 1,
  },
  actionLabelDisabled: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  noActions: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    paddingVertical: 24,
  },
  stepTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  targetList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  oppSection: {
    gap: 8,
  },
  oppBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.bgSurface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  oppName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  oppLife: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accentRed,
  },
  oppCourt: {
    paddingLeft: 16,
    gap: 6,
  },
  courtHint: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
});
