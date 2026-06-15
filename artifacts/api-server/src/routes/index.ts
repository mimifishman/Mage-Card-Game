import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import gameRouter from "./game";
import matchesRouter from "./matches";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/game", gameRouter);
router.use("/matches", matchesRouter);
router.use(adminRouter);

export default router;
