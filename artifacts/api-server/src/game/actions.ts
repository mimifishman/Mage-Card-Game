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
  targetPlayerId: z.string().optional(),
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
  targetPlayerId: z.string().optional(),
});

export const AttachSpadeActionSchema = z.object({
  type: z.literal("attach_spade"),
  spadeCardId: z.string(),
  targetRoyalId: z.string(),
  targetPlayerId: z.string().optional(),
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
  targetPlayerId: z.string().optional(),
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
  targetPlayerId: z.string(),
  royalCardIds: z.array(z.string()).min(1),
});

export const ConfirmDeclareBlocksActionSchema = z.object({
  type: z.literal("confirm_declare_blocks"),
  blocks: z.record(
    z.string(),
    z.preprocess(
      (val) => (Array.isArray(val) && val.length === 0 ? "pass" : val),
      z.union([z.literal("pass"), z.array(z.string()).min(1)]),
    ),
  ),
});

export const SetDamageOrderActionSchema = z.object({
  type: z.literal("set_damage_order"),
  assignments: z.record(z.string(), z.array(z.string())),
});

export const DuelPassActionSchema = z.object({
  type: z.literal("duel_pass"),
});

export const EndTurnActionSchema = z.object({
  type: z.literal("end_turn"),
});

export const DiscardToEndTurnActionSchema = z.object({
  type: z.literal("discard_to_end_turn"),
  cardId: z.string(),
});

export const ConfirmClubResponseActionSchema = z.object({
  type: z.literal("confirm_club_response"),
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
  ConfirmDeclareBlocksActionSchema,
  SetDamageOrderActionSchema,
  DuelPassActionSchema,
  EndTurnActionSchema,
  DiscardToEndTurnActionSchema,
  ConfirmClubResponseActionSchema,
]);

export type GameAction = z.infer<typeof GameActionSchema>;
