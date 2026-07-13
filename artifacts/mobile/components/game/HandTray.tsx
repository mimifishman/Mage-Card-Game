import React from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
} from "react-native";
import CardView from "./CardView";
import Colors from "@/constants/colors";
import { parseCardId } from "@/lib/gameUtils";

interface HandTrayProps {
  cards: string[];
  selectedCardId: string | null;
  isMyTurn: boolean;
  isDefender?: boolean;
  isClubResponder?: boolean;
  isMyDuelTurn?: boolean;
  isMyInterruptTurn?: boolean;
  canInitiateInterrupt?: boolean;
  phase: string;
  /** My available Vault — cards I can't pay for show a red cost chip. */
  vault?: number;
  /** My seat color — used for the "can act" edge. */
  accentColor?: string;
  /** Single source of truth for whether a card has any legal play right now;
      when it returns false the card is muted. Supplied by the match screen
      (which runs getValidActionsForCard with full game context). */
  canPlayCard?: (cardId: string) => boolean;
  onCardPress: (cardId: string) => void;
}

function isCardEligibleAsInterrupt(cardId: string): boolean {
  try {
    const card = parseCardId(cardId);
    return !card.isRoyal;
  } catch {
    return false;
  }
}

function isCardPlayableDuringClubResponse(cardId: string): boolean {
  try {
    const card = parseCardId(cardId);
    return !card.isRoyal && !card.isJoker;
  } catch {
    return false;
  }
}

export default function HandTray({
  cards,
  selectedCardId,
  isMyTurn,
  isDefender = false,
  isClubResponder = false,
  isMyDuelTurn = false,
  isMyInterruptTurn = false,
  canInitiateInterrupt = false,
  phase,
  vault = 0,
  accentColor = Colors.brand,
  canPlayCard,
  onCardPress,
}: HandTrayProps) {
  const globalCanPlay =
    (isMyTurn && (phase === "main" || phase === "discard")) ||
    (isDefender && phase === "declare_blocks") ||
    (isClubResponder && phase === "respond_to_club") ||
    isMyDuelTurn ||
    isMyInterruptTurn ||
    canInitiateInterrupt;

  const respondOnly =
    canInitiateInterrupt && !isMyTurn && !isMyDuelTurn && !isMyInterruptTurn && !isDefender && !isClubResponder;

  const hintText = () => {
    if (phase === "discard") return "Tap a card to discard it";
    if (isDefender && phase === "declare_blocks") return "You can still play cards while blocking";
    if (isClubResponder) return "Protect your Royal — Royals themselves can't be played now";
    if (isMyInterruptTurn) return "Play a card or pass";
    if (isMyDuelTurn) return "Play a card to swing the duel — or pass";
    if (respondOnly) return null;
    return "Tap a card, then tap a glowing target";
  };
  const hint = globalCanPlay ? hintText() : null;

  return (
    <View style={[styles.container, globalCanPlay && !respondOnly && { borderTopColor: accentColor }]}>
      <View style={styles.header}>
        <Text style={styles.label}>HAND · {cards.length}</Text>
        {hint && <Text style={[styles.hint, { color: accentColor }]}>{hint}</Text>}
        {respondOnly && (
          <View style={styles.respondPill}>
            <Text style={styles.respondPillText}>⚡ You may respond</Text>
          </View>
        )}
      </View>
      {cards.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No cards in hand</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {cards.map((cardId, idx) => {
            const card = parseCardId(cardId);
            // Prefer the authoritative check from the match screen; fall back
            // to the local heuristic only if it wasn't supplied.
            const cardPlayable = canPlayCard
              ? canPlayCard(cardId)
              : globalCanPlay &&
                (isClubResponder
                  ? isCardPlayableDuringClubResponse(cardId)
                  : respondOnly
                    ? isCardEligibleAsInterrupt(cardId)
                    : true);
            const isSelected = selectedCardId === cardId;
            const unaffordable = card.vaultCost > vault && phase !== "discard";

            return (
              <Pressable
                key={cardId}
                onPress={() => onCardPress(cardId)}
                style={({ pressed }) => [
                  styles.cardWrapper,
                  idx > 0 && styles.cardOverlap,
                  pressed && { opacity: 0.75 },
                  isSelected && styles.cardWrapperSelected,
                ]}
              >
                <CardView
                  cardId={cardId}
                  size="lg"
                  selected={isSelected}
                  dimmed={!cardPlayable}
                  unaffordable={unaffordable}
                />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgHandTray,
    borderTopWidth: 2.5,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
    paddingBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  hint: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  respondPill: {
    marginLeft: "auto",
    backgroundColor: "rgba(90,176,255,0.15)",
    borderWidth: 1,
    borderColor: "#5AB0FF",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  respondPillText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#5AB0FF",
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  cardWrapper: {
    borderRadius: 10,
  },
  cardOverlap: {
    marginLeft: -14,
  },
  cardWrapperSelected: {
    transform: [{ translateY: -10 }],
    zIndex: 10,
  },
  empty: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
});
