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
  phase: string;
  onCardPress: (cardId: string) => void;
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
  phase,
  onCardPress,
}: HandTrayProps) {
  const globalCanPlay =
    (isMyTurn && (phase === "main" || phase === "discard")) ||
    (isDefender && phase === "declare_blocks") ||
    (isClubResponder && phase === "respond_to_club") ||
    isMyDuelTurn;

  const hintText = () => {
    if (phase === "discard") return "Tap a card to discard";
    if (phase === "declare_blocks") return "Tap a card to play while blocking";
    if (phase === "respond_to_club") return "Hearts, Spades, Clubs, Diamonds only";
    if (isMyDuelTurn) return "Tap a card to play during duel";
    return "Tap a card to play";
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>HAND</Text>
        <View style={styles.countBadge}>
          <Text style={styles.count}>{cards.length}</Text>
        </View>
        {globalCanPlay && (
          <Text style={styles.hint}>{hintText()}</Text>
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
          {cards.map((cardId) => {
            const cardPlayable =
              globalCanPlay &&
              (isClubResponder
                ? isCardPlayableDuringClubResponse(cardId)
                : true);
            const isSelected = selectedCardId === cardId;

            return (
              <Pressable
                key={cardId}
                onPress={() => cardPlayable && onCardPress(cardId)}
                style={({ pressed }) => [
                  styles.cardWrapper,
                  pressed && cardPlayable && { opacity: 0.75 },
                  isSelected && styles.cardWrapperSelected,
                ]}
              >
                <CardView
                  cardId={cardId}
                  size="lg"
                  selected={isSelected}
                  dimmed={!cardPlayable}
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
    borderTopWidth: 2,
    borderTopColor: Colors.borderLight,
    paddingTop: 10,
    paddingBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  countBadge: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  count: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  hint: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginLeft: 4,
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 8,
    paddingBottom: 4,
  },
  cardWrapper: {
    borderRadius: 10,
  },
  cardWrapperSelected: {
    transform: [{ translateY: -8 }],
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
