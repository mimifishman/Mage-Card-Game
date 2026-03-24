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

interface HandTrayProps {
  cards: string[];
  selectedCardId: string | null;
  isMyTurn: boolean;
  phase: string;
  onCardPress: (cardId: string) => void;
}

export default function HandTray({
  cards,
  selectedCardId,
  isMyTurn,
  phase,
  onCardPress,
}: HandTrayProps) {
  const canPlay = isMyTurn && phase === "main";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>HAND</Text>
        <View style={styles.countBadge}>
          <Text style={styles.count}>{cards.length}</Text>
        </View>
        {canPlay && <Text style={styles.hint}>Tap a card to play</Text>}
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
          {cards.map((cardId) => (
            <Pressable
              key={cardId}
              onPress={() => canPlay && onCardPress(cardId)}
              style={({ pressed }) => [
                styles.cardWrapper,
                pressed && canPlay && { opacity: 0.75 },
                selectedCardId === cardId && styles.cardWrapperSelected,
              ]}
            >
              <CardView
                cardId={cardId}
                size="lg"
                selected={selectedCardId === cardId}
                dimmed={!canPlay}
              />
            </Pressable>
          ))}
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
