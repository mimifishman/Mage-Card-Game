import type { CreateMatchRequestBotPersona } from "@workspace/api-client-react";

export interface BotPersonaOption {
  key: CreateMatchRequestBotPersona;
  mageName: string;
  description: string;
  accent: string;
  accentBg: string;
  icon: "fire" | "snowflake" | "gold" | "dice";
}

/**
 * Mage-themed presentation for the bot's internal personas. The `key` is the
 * value sent to (and returned by) the API; everything else is display-only.
 */
export const BOT_PERSONAS: BotPersonaOption[] = [
  {
    key: "aggressor",
    mageName: "Emberlord",
    description: "Relentless attacker, races you down",
    accent: "#E5484D",
    accentBg: "rgba(229,72,77,0.15)",
    icon: "fire",
  },
  {
    key: "controller",
    mageName: "Frostweaver",
    description: "Defensive tactician, destroys your board and grinds you out",
    accent: "#4C9EE8",
    accentBg: "rgba(76,158,232,0.15)",
    icon: "snowflake",
  },
  {
    key: "economist",
    mageName: "Gildspinner",
    description: "Unpredictable hoarder, plays the long game",
    accent: "#C89B3C",
    accentBg: "rgba(200,155,60,0.15)",
    icon: "gold",
  },
  {
    key: "random",
    mageName: "Fatecaller",
    description: "A random mage each match — rematches reshuffle",
    accent: "#9B59B6",
    accentBg: "rgba(155,89,182,0.15)",
    icon: "dice",
  },
];

export function personaMageName(key: string | null | undefined): string | null {
  if (!key) return null;
  return BOT_PERSONAS.find((p) => p.key === key)?.mageName ?? null;
}
