import { Router, type IRouter, type Request, type Response } from "express";

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

export default router;
