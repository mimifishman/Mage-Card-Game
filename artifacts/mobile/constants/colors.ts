const BRAND = "#C89B3C";
const BRAND_DIM = "#8B6914";
const BG_FELT = "#0D2B1A";
const BG_CARD_FACE = "#F8F4E9";
const BG_ZONE_DEEP = "#0A1F13";
const BG_ZONE_MID = "#122B1A";
const BG_ZONE_SURFACE = "#1A3824";
const BG_HAND_TRAY = "#0C2317";
const TEXT_PRIMARY = "#F0E6C8";
const TEXT_SECONDARY = "#C8B88A";
const TEXT_MUTED = "#7A9E8A";
const TEXT_ON_CARD = "#1A1208";
const SUIT_RED = "#C8102E";
const SUIT_BLUE = "#1565C0";
const SUIT_GREEN = "#1B5E20";
const SUIT_INK = "#0D0D0D";
const ACCENT_RED = "#E53935";
const ACCENT_BLUE = "#1976D2";
const ACCENT_GREEN = "#2E7D32";
const BORDER = "#1E4A2A";
const BORDER_LIGHT = "#2D6040";

// Per-seat accent colors, assigned by turn order for the whole match.
// Used on seat borders, name tags, attack arrows and event-ticker entries so
// "who did that?" is always answerable by color alone.
// Deliberately NO yellow/gold here — that hue is reserved for UI accents
// (brand, active rings, Vault) and a yellow player would be confusing.
export const SEAT_COLORS = ["#5AB0FF", "#C86BD4", "#FF8A5B", "#2DD4BF"] as const;

export function seatColorFor(index: number): string {
  return SEAT_COLORS[((index % SEAT_COLORS.length) + SEAT_COLORS.length) % SEAT_COLORS.length]!;
}

// Hit-effect palette, one entry per suit (plus Joker). The base suit colors
// above are too dark to read against the felt board, so each effect gets a
// bright `accent` and a near-white `flash` alongside its `core` suit color.
// Spades keep an ink core but use steel/white so the sword survives the dark
// background.
export type SuitFxKey = "C" | "H" | "D" | "S" | "JOKER";
export const SUIT_FX: Record<SuitFxKey, { core: string; accent: string; flash: string }> = {
  C: { core: SUIT_GREEN, accent: "#66BB6A", flash: "#E8F5E9" },
  H: { core: SUIT_RED, accent: "#F06292", flash: "#FCE4EC" },
  D: { core: SUIT_BLUE, accent: "#64B5F6", flash: "#E3F2FD" },
  S: { core: SUIT_INK, accent: "#CFD8DC", flash: "#FFFFFF" },
  JOKER: { core: BRAND, accent: "#FFD54F", flash: "#FFF8E1" },
};

const Colors = {
  brand: BRAND,
  brandDim: BRAND_DIM,
  bgDeep: BG_FELT,
  bgCard: BG_ZONE_MID,
  bgCardFace: BG_CARD_FACE,
  bgSurface: BG_ZONE_SURFACE,
  bgZoneDeep: BG_ZONE_DEEP,
  bgHandTray: BG_HAND_TRAY,
  textPrimary: TEXT_PRIMARY,
  textSecondary: TEXT_SECONDARY,
  textMuted: TEXT_MUTED,
  textOnCard: TEXT_ON_CARD,
  suitRed: SUIT_RED,
  suitBlue: SUIT_BLUE,
  suitGreen: SUIT_GREEN,
  suitInk: SUIT_INK,
  accentRed: ACCENT_RED,
  accentBlue: ACCENT_BLUE,
  accentGreen: ACCENT_GREEN,
  border: BORDER,
  borderLight: BORDER_LIGHT,
  suitFx: SUIT_FX,
};

export default Colors;
