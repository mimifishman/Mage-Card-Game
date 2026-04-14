import { z } from "zod";

export const PlayDiamondToMineActionSchema = z.object({
  type: z.literal("play_diamond_to_mine"),
  cardId: z.string(),
});

export const DiscardDiamondToDrawActionSchema = z.object({
  type: z.literal("discard_diamond_to_draw"),
  cardId: z.string(),
});

export const DiscardDiamondForBoostActionSchema = z.object({
  type: z.literal("discard_diamond_for_boost"),
  cardId: z.string(),
});

export const PlayRoyalToCourtActionSchema = z.object({
  type: z.literal("play_royal_to_court"),
  cardId: z.string(),
});

export const AttachRoyalSupportActionSchema = z.object({
  type: z.literal("attach_royal_support"),
  supportCardId: z.string(),
  targetRoyalId: z.string(),
});

export const AttachHeartActionSchema = z.object({
  type: z.literal("attach_heart"),
  heartCardId: z.string(),
  targetRoyalId: z.string(),
});

export const AttachSpadeActionSchema = z.object({
  type: z.literal("attach_spade"),
  spadeCardId: z.string(),
  targetRoyalId: z.string(),
});

export const DiscardToAbyssActionSchema = z.object({
  type: z.literal("discard_to_abyss"),
  cardId: z.string(),
});

export const ApplyClubActionSchema = z.object({
  type: z.literal("apply_club"),
  clubCardId: z.string(),
  targetPlayerId: z.string(),
  targetRoyalId: z.string().optional(),
});

export const DiscardHeartToHealActionSchema = z.object({
  type: z.literal("discard_heart_to_heal"),
  heartCardId: z.string(),
  targetPlayerId: z.string(),
});

export const DiscardSpadeToReturnActionSchema = z.object({
  type: z.literal("discard_spade_to_return"),
  spadeCardId: z.string(),
  targetCardId: z.string(),
});

export const PlayJokerActionSchema = z.object({
  type: z.literal("play_joker"),
  cardId: z.string(),
  mode: z.enum(["destroy_royal", "damage_player"]),
  targetRoyalId: z.string().optional(),
  targetPlayerId: z.string().optional(),
});

export const DeclareAttackActionSchema = z.object({
  type: z.literal("declare_attack"),
  attackerRoyalId: z.string(),
  targetPlayerId: z.string(),
});

export const BeginDeclareBlocksActionSchema = z.object({
  type: z.literal("begin_declare_blocks"),
});

export const DeclareBlockActionSchema = z.object({
  type: z.literal("declare_block"),
  blockerRoyalId: z.string(),
  attackerRoyalId: z.string(),
});

export const PassBlockActionSchema = z.object({
  type: z.literal("pass_block"),
  attackerRoyalId: z.string(),
});

export const ResolveCombatActionSchema = z.object({
  type: z.literal("resolve_combat"),
});

export const EndTurnActionSchema = z.object({
  type: z.literal("end_turn"),
});

export const GameActionSchema = z.discriminatedUnion("type", [
  PlayDiamondToMineActionSchema,
  DiscardDiamondToDrawActionSchema,
  DiscardDiamondForBoostActionSchema,
  DiscardToAbyssActionSchema,
  PlayRoyalToCourtActionSchema,
  AttachRoyalSupportActionSchema,
  AttachHeartActionSchema,
  AttachSpadeActionSchema,
  DiscardHeartToHealActionSchema,
  DiscardSpadeToReturnActionSchema,
  ApplyClubActionSchema,
  PlayJokerActionSchema,
  DeclareAttackActionSchema,
  BeginDeclareBlocksActionSchema,
  DeclareBlockActionSchema,
  PassBlockActionSchema,
  ResolveCombatActionSchema,
  EndTurnActionSchema,
]);

export type GameAction = z.infer<typeof GameActionSchema>;
