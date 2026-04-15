import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/authMiddleware";
import {
  createMatch,
  joinMatchByCode,
  getMatchWithPlayers,
  isMatchHost,
  isMatchPlayer,
  getMatchPlayerOrder,
  startMatch,
  loadEngineState,
  saveEngineState,
  finishMatch,
  resetMatchForRematch,
  logAction,
} from "../repositories/matchRepository";
import { createInitialGameState, determineFirstPlayer, dealInitialHands } from "../game";
import { dispatchAction } from "../game/dispatcher";
import { GameActionSchema } from "../game/actions";
import { buildPlayerView, broadcastViews } from "../game/serializer";
import { sendToUser, broadcastToMatch } from "../ws/manager";
import { isGameOver, getWinner } from "../game";

const router: IRouter = Router();
router.use(requireAuth);

router.post("/", async (req: Request, res: Response) => {
  const userId = req.user!.internalUserId;
  try {
    const match = await createMatch(userId);
    res.status(201).json({ match: { id: match.id, inviteCode: match.inviteCode, status: match.status } });
  } catch (err) {
    req.log.error({ err }, "Failed to create match");
    res.status(500).json({ error: "Failed to create match" });
  }
});

router.post("/join", async (req: Request, res: Response) => {
  const userId = req.user!.internalUserId;
  const { inviteCode } = req.body as { inviteCode?: unknown };
  if (typeof inviteCode !== "string" || !inviteCode.trim()) {
    res.status(400).json({ error: "inviteCode is required" });
    return;
  }

  try {
    const result = await joinMatchByCode(inviteCode.trim(), userId);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    const data = await getMatchWithPlayers(result.match.id);
    broadcastToMatch(result.match.id, {
      type: "player_joined",
      matchId: result.match.id,
      userId,
      playerCount: data?.players.length ?? 0,
    });

    res.json({ match: { id: result.match.id, inviteCode: result.match.inviteCode, status: result.match.status } });
  } catch (err) {
    req.log.error({ err }, "Failed to join match");
    res.status(500).json({ error: "Failed to join match" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.internalUserId;
  const { id } = req.params as { id: string };

  try {
    const data = await getMatchWithPlayers(id);
    if (!data) {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    const isPlayer = data.players.some((p) => p.userId === userId);
    if (!isPlayer) {
      res.status(403).json({ error: "Not a member of this match" });
      return;
    }

    res.json({
      match: {
        id: data.match.id,
        status: data.match.status,
        inviteCode: data.match.inviteCode,
        createdBy: data.match.createdBy,
        turnNumber: data.match.turnNumber,
        currentTurnPlayerId: data.match.currentTurnPlayerId,
        winnerUserId: data.match.winnerUserId,
        startedAt: data.match.startedAt,
        finishedAt: data.match.finishedAt,
      },
      players: data.players.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        turnOrder: p.turnOrder,
        life: p.life,
        isEliminated: p.isEliminated,
        joinedAt: p.joinedAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get match");
    res.status(500).json({ error: "Failed to get match" });
  }
});

router.post("/:id/start", async (req: Request, res: Response) => {
  const userId = req.user!.internalUserId;
  const { id } = req.params as { id: string };

  try {
    const data = await getMatchWithPlayers(id);
    if (!data) {
      res.status(404).json({ error: "Match not found" });
      return;
    }
    if (data.match.status !== "waiting") {
      res.status(400).json({ error: "Match has already started or finished" });
      return;
    }
    const host = await isMatchHost(id, userId);
    if (!host) {
      res.status(403).json({ error: "Only the host can start the match" });
      return;
    }
    if (data.players.length < 2) {
      res.status(400).json({ error: "Need at least 2 players to start" });
      return;
    }

    const playerIds = await getMatchPlayerOrder(id);
    const stateResult = createInitialGameState(id, playerIds);
    if (!stateResult.ok) {
      res.status(400).json({ error: stateResult.error });
      return;
    }

    const withFirst = determineFirstPlayer(stateResult.value);
    if (!withFirst.ok) {
      res.status(500).json({ error: withFirst.error });
      return;
    }

    const withHands = dealInitialHands(withFirst.value);
    if (!withHands.ok) {
      res.status(500).json({ error: withHands.error });
      return;
    }

    const engineState = withHands.value;
    await startMatch(id, engineState);

    broadcastViews(engineState, playerIds, (uid, view) => {
      sendToUser(id, uid, { type: "game_started", state: view });
    });

    res.json({ matchId: id, status: "in_progress" });
  } catch (err) {
    req.log.error({ err }, "Failed to start match");
    res.status(500).json({ error: "Failed to start match" });
  }
});

router.post("/:id/actions", async (req: Request, res: Response) => {
  const userId = req.user!.internalUserId;
  const { id } = req.params as { id: string };

  const parsed = GameActionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid action", details: parsed.error.flatten() });
    return;
  }
  const action = parsed.data;

  try {
    const member = await isMatchPlayer(id, userId);
    if (!member) {
      res.status(403).json({ error: "Not a member of this match" });
      return;
    }

    const matchData = await getMatchWithPlayers(id);
    if (!matchData) {
      res.status(404).json({ error: "Match not found" });
      return;
    }
    if (matchData.match.status !== "in_progress") {
      res.status(400).json({ error: `Match is not in progress (status: ${matchData.match.status})` });
      return;
    }

    const engineState = await loadEngineState(id);
    if (!engineState) {
      res.status(400).json({ error: "Match state is missing" });
      return;
    }

    const result = dispatchAction(engineState, userId, action);
    if (!result.ok) {
      res.status(422).json({ error: result.error });
      return;
    }

    const newState = result.value;

    const playerIds = Object.keys(newState.players);
    const myView = buildPlayerView(newState, userId);

    if (isGameOver(newState)) {
      const winner = getWinner(newState);
      await saveEngineState(id, newState);
      if (winner) await finishMatch(id, winner);
      await logAction(id, userId, action, newState.turnNumber);

      broadcastViews(newState, playerIds, (uid, view) => {
        sendToUser(id, uid, {
          type: "game_over",
          state: view,
          winnerUserId: winner ?? null,
        });
      });

      res.json({ ok: true, phase: newState.phase, state: myView, winnerUserId: winner ?? null });
    } else {
      await saveEngineState(id, newState);
      await logAction(id, userId, action, newState.turnNumber);

      broadcastViews(newState, playerIds, (uid, view) => {
        sendToUser(id, uid, { type: "state_update", state: view });
      });

      res.json({ ok: true, phase: newState.phase, state: myView });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to process action");
    res.status(500).json({ error: "Failed to process action" });
  }
});

router.get("/:id/state", async (req: Request, res: Response) => {
  const userId = req.user!.internalUserId;
  const { id } = req.params as { id: string };

  try {
    const member = await isMatchPlayer(id, userId);
    if (!member) {
      res.status(403).json({ error: "Not a member of this match" });
      return;
    }

    const engineState = await loadEngineState(id);
    if (!engineState) {
      res.status(400).json({ error: "Match has not started yet" });
      return;
    }

    const view = buildPlayerView(engineState, userId);
    res.json({ state: view });
  } catch (err) {
    req.log.error({ err }, "Failed to get match state");
    res.status(500).json({ error: "Failed to get match state" });
  }
});

router.post("/:id/rematch", async (req: Request, res: Response) => {
  const userId = req.user!.internalUserId;
  const { id } = req.params as { id: string };

  try {
    const player = await isMatchPlayer(id, userId);
    if (!player) {
      res.status(403).json({ error: "You are not a participant in this match" });
      return;
    }

    const data = await getMatchWithPlayers(id);
    if (!data) {
      res.status(404).json({ error: "Match not found" });
      return;
    }
    if (data.match.status !== "finished") {
      res.status(400).json({ error: "Match is not finished yet" });
      return;
    }

    await resetMatchForRematch(id);

    broadcastToMatch(id, { type: "rematch", matchId: id });

    res.json({ ok: true, matchId: id });
  } catch (err) {
    req.log.error({ err }, "Failed to initiate rematch");
    res.status(500).json({ error: "Failed to initiate rematch" });
  }
});

export default router;
