import { clerkMiddleware, getAuth } from "@clerk/express";
import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { clerkClient } from "../auth";

export interface AuthUser {
  providerUserId: string;
  displayName: string;
  internalUserId: string;
}

declare global {
  namespace Express {
    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: AuthUser;
    }

    interface AuthedRequest extends Request {
      user: AuthUser;
    }
  }
}

export { clerkMiddleware };

export async function populateUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const auth = getAuth(req);
  if (auth.userId) {
    try {
      const [existing] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.providerUserId, auth.userId))
        .limit(1);

      if (existing && !existing.displayName.startsWith("user_")) {
        req.user = {
          providerUserId: existing.providerUserId,
          displayName: existing.displayName,
          internalUserId: existing.id,
        };
      } else {
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        const displayName =
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
          clerkUser.username ||
          clerkUser.emailAddresses[0]?.emailAddress?.split("@")[0] ||
          auth.userId;

        if (existing) {
          const [updated] = await db
            .update(usersTable)
            .set({ displayName })
            .where(eq(usersTable.id, existing.id))
            .returning();
          req.user = {
            providerUserId: updated.providerUserId,
            displayName: updated.displayName,
            internalUserId: updated.id,
          };
        } else {
          const [user] = await db
            .insert(usersTable)
            .values({ providerUserId: auth.userId, displayName })
            .returning();
          req.user = {
            providerUserId: user.providerUserId,
            displayName: user.displayName,
            internalUserId: user.id,
          };
        }
      }
    } catch (err) {
      req.log.warn({ err }, "Failed to resolve user from Clerk; continuing unauthenticated");
    }
  }

  next();
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
