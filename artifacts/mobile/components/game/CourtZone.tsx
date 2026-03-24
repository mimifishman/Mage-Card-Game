import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import type { RoyalInCourt } from "@workspace/api-client-react";
import CardView from "./CardView";
import Colors from "@/constants/colors";

interface CourtZoneProps {
  court: RoyalInCourt[];
  label?: string;
  isMyZone?: boolean;
  isMyTurn?: boolean;
  selectedTargetId?: string | null;
  onRoyalPress?: (royalId: string) => void;
  size?: "sm" | "md" | "lg";
}

export default function CourtZone({
  court,
  label,
  isMyZone = false,
  isMyTurn = false,
  selectedTargetId = null,
  onRoyalPress,
  size = "md",
}: CourtZoneProps) {
  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, isMyZone && styles.labelMine]}>{label}</Text>
      )}
      {court.length === 0 ? (
        <View style={[styles.emptySlot, isMyZone && styles.emptySlotMine]}>
          <Text style={[styles.emptyText, isMyZone && styles.emptyTextMine]}>Empty Court</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {court.map((royal) => {
            const canInteract = !!onRoyalPress;
            const isSelected = selectedTargetId === royal.cardId;
            return (
              <Pressable
                key={royal.cardId}
                onPress={() => canInteract && onRoyalPress?.(royal.cardId)}
                style={({ pressed }) => [
                  styles.royalWrapper,
                  pressed && canInteract && { opacity: 0.75 },
                  isSelected && styles.royalSelected,
                ]}
                disabled={!canInteract}
              >
                <CardView
                  cardId={royal.cardId}
                  royal={royal}
                  size={size}
                  hasAttacked={royal.hasAttackedThisTurn}
                  selected={isSelected}
                />
                {royal.hasAttackedThisTurn && (
                  <View style={styles.attackedBadge}>
                    <Text style={styles.attackedText}>ATK</Text>
                  </View>
                )}
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
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 1.5,
    paddingHorizontal: 4,
    textTransform: "uppercase",
  },
  labelMine: {
    color: Colors.textSecondary,
  },
  scrollContent: {
    gap: 6,
    paddingHorizontal: 4,
  },
  emptySlot: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13,43,26,0.5)",
  },
  emptySlotMine: {
    borderColor: Colors.borderLight,
    backgroundColor: "rgba(26,56,36,0.5)",
  },
  emptyText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
  },
  emptyTextMine: {
    color: Colors.textSecondary,
  },
  royalWrapper: {
    position: "relative",
    alignItems: "center",
  },
  royalSelected: {
    transform: [{ translateY: -4 }],
  },
  attackedBadge: {
    marginTop: 2,
    backgroundColor: "rgba(200,155,60,0.2)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: "rgba(200,155,60,0.4)",
  },
  attackedText: {
    fontSize: 7,
    color: Colors.brand,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
});
