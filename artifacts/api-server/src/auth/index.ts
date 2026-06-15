import { createClerkClient } from "@clerk/express";

export type { AuthSession } from "./types";

export const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});
