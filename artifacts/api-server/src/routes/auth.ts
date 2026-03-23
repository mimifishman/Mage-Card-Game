import { Router, type IRouter, type Request, type Response } from "express";
import { authService } from "../auth";

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

router.get("/auth/callback", async (req: Request, res: Response) => {
  await authService.handleCallback(req, res);
});

router.get("/login", async (req: Request, res: Response) => {
  await authService.handleLogin(req, res);
});

router.get("/logout", async (req: Request, res: Response) => {
  await authService.handleLogout(req, res);
});

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    await authService.handleMobileTokenExchange(req, res);
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  await authService.handleMobileLogout(req, res);
});

export default router;
