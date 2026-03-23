import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/authMiddleware";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/status", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ status: "ok", userId: req.user.internalUserId });
});

export default router;
