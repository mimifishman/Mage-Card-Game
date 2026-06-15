import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import gameRouter from "./game";
import matchesRouter from "./matches";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/game", gameRouter);
router.use("/matches", matchesRouter);

export default router;
