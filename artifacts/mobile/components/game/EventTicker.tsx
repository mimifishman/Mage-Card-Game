import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Colors from "@/constants/colors";

/** Structured match-log entry. Simple events use just `text` (+ optional
    `actor`); multi-part outcomes (combat results) add indented `sublines`. */
export interface GameEvent {
  id: number;
  /** Seat color of the player the event is about (grey for neutral events). */
  color: string;
  /** Headline / action text. Card references like "K♠" render as chips. */
  text: string;
  /** Who did it — rendered bold in the seat color before the text. */
  actor?: string;
  /** Indented per-outcome lines under the headline. */
  sublines?: string[];
  /** Small badge before the actor, e.g. "⚡" for off-turn plays or "auto". */
  tag?: string;
  /** Epoch ms when the entry was logged; rendered as HH:MM:SS. */
  at: number;
}

function formatTime(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface EventTickerProps {
  events: GameEvent[];
}

// Matches card references produced by cardLabel()/royalStatLabel():
// "K♠", "10♥", "JKR★", optionally followed by a stat block "(⚔3 ♥3)".
// Buffed values render as a visible sum, e.g. "(⚔3+1 ♥0+1)", and clubs can
// push a term negative, e.g. "♥-1+2" — the regex accepts signed terms.
const CARD_TOKEN_RE =
  /((?:10|[AJQK2-9])[♥♠♦♣]|JKR★)(?:\s*\((⚔-?\d+(?:[+-]\d+)?)\s+(♥-?\d+(?:[+-]\d+)?)\))?/g;

const SUIT_COLORS: Record<string, string> = {
  "♥": "#C8102E",
  "♦": "#1565C0",
  "♣": "#1B5E20",
  "♠": "#1A1A1A",
  "★": "#8A6A1E",
};

/** A compact card badge: mini-card look (light face, suit-colored text),
    with an optional muted stat suffix. */
export function CardChip({ label, stats }: { label: string; stats?: string }) {
  const suit = label[label.length - 1] ?? "";
  const color = SUIT_COLORS[suit] ?? "#1A1A1A";
  return (
    <View style={chipStyles.wrap}>
      <View style={chipStyles.chip}>
        <Text style={[chipStyles.chipText, { color }]}>{label}</Text>
      </View>
      {stats ? <Text style={chipStyles.stats}>{stats}</Text> : null}
    </View>
  );
}

/** Renders a log line, replacing inline card references with CardChips.
    Uses a wrapping row so chips can be real (rounded) views. */
export function RichLine({
  text,
  actor,
  actorColor,
  tag,
  textStyle,
  showStats = true,
}: {
  text: string;
  actor?: string;
  actorColor?: string;
  tag?: string;
  textStyle?: object;
  showStats?: boolean;
}) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  const pushText = (s: string) => {
    if (!s) return;
    // Split into words so the row can wrap naturally.
    for (const w of s.split(/(\s+)/)) {
      if (w.trim().length === 0) continue;
      parts.push(
        <Text key={`t${key++}`} style={[chipStyles.lineText, textStyle]}>
          {w}
        </Text>,
      );
    }
  };
  CARD_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CARD_TOKEN_RE.exec(text)) !== null) {
    pushText(text.slice(last, m.index));
    parts.push(
      <CardChip
        key={`c${key++}`}
        label={m[1]!}
        stats={showStats && m[2] ? `${m[2]} ${m[3]}` : undefined}
      />,
    );
    last = m.index + m[0].length;
  }
  pushText(text.slice(last));

  return (
    <View style={chipStyles.lineRow}>
      {tag ? <Text style={chipStyles.tag}>{tag}</Text> : null}
      {actor ? (
        <Text style={[chipStyles.actor, actorColor ? { color: actorColor } : null]}>{actor}</Text>
      ) : null}
      {parts}
    </View>
  );
}

/** Rolling match log: shows the last couple of events inline; tap to expand
    the full history. Replaces the old fade-away combat banner so state
    changes are never missable. */
export default function EventTicker({ events }: EventTickerProps) {
  const [expanded, setExpanded] = useState(false);
  const recent = events.slice(-2).reverse();
  const all = [...events].reverse();

  if (events.length === 0) return null;

  const rows = (list: GameEvent[], latestBold: boolean) =>
    list.map((ev, i) => (
      <Animated.View key={ev.id} entering={FadeIn.duration(250)} style={styles.row}>
        <View style={[styles.dot, { backgroundColor: ev.color }]} />
        <Text style={styles.timestamp}>{formatTime(ev.at)}</Text>
        <View style={styles.body}>
          <RichLine
            text={ev.text}
            actor={ev.actor}
            actorColor={ev.color}
            tag={ev.tag}
            textStyle={i === 0 && latestBold ? styles.textLatest : undefined}
          />
          {ev.sublines?.map((line, j) => (
            <View key={j} style={styles.subline}>
              <RichLine text={line} />
            </View>
          ))}
        </View>
      </Animated.View>
    ));

  return (
    <Pressable onPress={() => setExpanded((e) => !e)} style={styles.container}>
      {expanded ? (
        <ScrollView style={styles.expandedList} nestedScrollEnabled>
          {rows(all, false)}
        </ScrollView>
      ) : (
        <ScrollView style={styles.collapsedList} nestedScrollEnabled>
          {rows(recent, true)}
        </ScrollView>
      )}
      <Text style={styles.expandHint}>{expanded ? "tap to collapse" : `log (${events.length})`}</Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  lineRow: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 4,
    rowGap: 2,
  },
  lineText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  actor: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
  },
  tag: {
    fontSize: 11,
    lineHeight: 18,
    color: "#C89B3C",
  },
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  chip: {
    backgroundColor: "#F3EEE2",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.35)",
  },
  chipText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Inter_700Bold",
  },
  stats: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 3,
    maxHeight: 220,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  body: {
    flex: 1,
    gap: 2,
  },
  subline: {
    flexDirection: "row",
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(255,255,255,0.12)",
    marginLeft: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  timestamp: {
    fontSize: 10,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    fontVariant: ["tabular-nums"],
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  textLatest: {
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  expandHint: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    alignSelf: "flex-end",
  },
  collapsedList: {
    maxHeight: 96,
  },
  expandedList: {
    maxHeight: 220,
  },
});
