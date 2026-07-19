import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

/**
 * The AI opponent is a regular row in `users` with a reserved provider-id
 * prefix, so every FK (match_players, game_actions_log, matches.winner_user_id)
 * works unchanged. The prefix is the single source of truth for "is a bot" —
 * real users get Clerk/OIDC provider ids that never start with it.
 */
export const BOT_PROVIDER_PREFIX = "bot:";

export const DEFAULT_BOT = {
  providerUserId: "bot:ai-mage-v1",
  displayName: "AI Mage",
} as const;

export function isBotProviderId(providerUserId: string): boolean {
  return providerUserId.startsWith(BOT_PROVIDER_PREFIX);
}

let cachedBotUserId: string | null = null;

/** Idempotently creates the bot user row and returns its internal user id. */
export async function ensureBotUser(): Promise<string> {
  if (cachedBotUserId) return cachedBotUserId;

  await db
    .insert(usersTable)
    .values({
      providerUserId: DEFAULT_BOT.providerUserId,
      displayName: DEFAULT_BOT.displayName,
    })
    .onConflictDoNothing({ target: usersTable.providerUserId });

  const [bot] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.providerUserId, DEFAULT_BOT.providerUserId));
  if (!bot) throw new Error("Failed to create bot user");

  cachedBotUserId = bot.id;
  return bot.id;
}
