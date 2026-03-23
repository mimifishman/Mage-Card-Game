import { Router, type IRouter, type Request, type Response } from "express";
import { authService } from "../auth";

const router: IRouter = Router();

router.get("/auth/user", (req: Request, res: Response) => {
  res.json({
    user: req.isAuthenticated()
      ? {
          id: req.user.internalUserId,
          displayName: req.user.displayName,
        }
      : null,
  });
});

router.get("/login", async (req: Request, res: Response) => {
  await authService.handleWebLogin(req, res);
});

router.get("/callback", async (req: Request, res: Response) => {
  await authService.handleWebCallback(req, res);
});

router.get("/logout", async (req: Request, res: Response) => {
  await authService.handleWebLogout(req, res);
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
