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
        <Text style={styles.count}>{cards.length}</Text>
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
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    paddingBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  count: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
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
    transform: [{ translateY: -6 }],
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
