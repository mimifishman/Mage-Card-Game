import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/authMiddleware";
import { clerkClient } from "../auth";
import { deleteUserAccountData } from "../repositories/accountRepository";
import { createDeleteAccountHandler } from "../services/accountDeletion";
import { sendToUser } from "../ws/manager";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/auth/me", (req: Request, res: Response) => {
  res.json({
    user: req.isAuthenticated()
      ? {
          id: req.user.internalUserId,
          displayName: req.user.displayName,
        }
      : null,
  });
});

router.delete(
  "/auth/account",
  requireAuth,
  createDeleteAccountHandler({
    deleteUserData: deleteUserAccountData,
    notifyEndedMatches: (ended) => {
      for (const match of ended) {
        for (const userId of match.notifyUserIds) {
          try {
            sendToUser(match.matchId, userId, { type: "game_over", winnerUserId: match.winnerUserId, state: null });
          } catch (err) {
            logger.warn({ err, matchId: match.matchId }, "Account deletion: game_over push failed");
          }
        }
      }
    },
    deleteAuthUser: async (providerUserId) => {
      await clerkClient.users.deleteUser(providerUserId);
    },
  }),
);

export default router;
