import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/authMiddleware";
import {
  createMatch,
  createVsAiMatch,
  joinMatchByCode,
  getMatchWithPlayers,
  isMatchHost,
  isMatchPlayer,
  loadEngineState,
  finishMatch,
  createRematch,
  getOpenMatchesForUser,
} from "../repositories/matchRepository";
import { ensureBotUser, isBotProviderId } from "../repositories/botRepository";
import { dispatchAction } from "../game/dispatcher";
import { GameActionSchema } from "../game/actions";
import { buildPlayerView } from "../game/serializer";
import { sendToUser, broadcastToMatch } from "../ws/manager";
import { initializeAndStartMatch, applyResultAndBroadcast } from "../services/matchStart";
import { kickBotRunner, markHumanActivity } from "../bot/runner";
import { SELECTABLE_PERSONA_KEYS, RANDOM_PERSONA_KEY, personaForMatch } from "../game/bot";
import { withMatchLock } from "../lib/matchLock";

type MatchPlayersData = NonNullable<Awaited<ReturnType<typeof getMatchWithPlayers>>>;

function botUserIds(data: MatchPlayersData): string[] {
  return data.players.filter((p) => isBotProviderId(p.providerUserId)).map((p) => p.userId);
}

const router: IRouter = Router();
router.use(requireAuth);

router.get("/mine", async (req: Request, res: Response) => {
  const userId = req.user!.internalUserId;
  try {
    const matches = await getOpenMatchesForUser(userId);
    res.json({ matches });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch user matches");
    res.status(500).json({ error: "Failed to fetch user matches" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  const userId = req.user!.internalUserId;
  const body = req.body as { vsAi?: unknown; botPersona?: unknown } | undefined;
  const vsAi = body?.vsAi === true;
  const rawPersona = body?.botPersona;

  try {
    if (!vsAi) {
      const match = await createMatch(userId);
      res.status(201).json({ match: { id: match.id, inviteCode: match.inviteCode, status: match.status } });
      return;
    }

    let botPersona: string | undefined;
    if (rawPersona !== undefined) {
      if (typeof rawPersona !== "string" || !SELECTABLE_PERSONA_KEYS.includes(rawPersona)) {
        res.status(400).json({ error: `Invalid botPersona — must be one of: ${SELECTABLE_PERSONA_KEYS.join(", ")}` });
        return;
      }
      botPersona = rawPersona;
    }

    const botUserId = await ensureBotUser();
    const match = await createVsAiMatch(userId, botUserId, botPersona);
    const started = await initializeAndStartMatch(match.id);
    if (!started.ok) {
      req.log.error({ matchId: match.id, error: started.error }, "Failed to start vs-AI match");
      await finishMatch(match.id, null);
      res.status(500).json({ error: "Failed to start match" });
      return;
    }

    // The bot may have won the first-player draw — let it take its turn.
    kickBotRunner(match.id, [botUserId]);

    res.status(201).json({ match: { id: match.id, inviteCode: match.inviteCode, status: "in_progress" } });
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

    if (!result.isRejoin) {
      const data = await getMatchWithPlayers(result.match.id);
      broadcastToMatch(result.match.id, {
        type: "player_joined",
        matchId: result.match.id,
        userId,
        playerCount: data?.players.length ?? 0,
      });
    }

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
        botPersona: data.match.botPersona,
        // "random" resolves per match id, so rematches roll a fresh persona;
        // expose the resolved key so the client can show which mage is playing.
        botPersonaResolved:
          data.match.botPersona === RANDOM_PERSONA_KEY
            ? personaForMatch(data.match.id).name
            : data.match.botPersona,
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
        isBot: isBotProviderId(p.providerUserId),
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

    const started = await initializeAndStartMatch(id);
    if (!started.ok) {
      res.status(400).json({ error: started.error });
      return;
    }

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
    req.log.warn({ body: req.body, errors: parsed.error.flatten() }, "Invalid action body — Zod rejected");
    res.status(400).json({ error: "Invalid action", details: parsed.error.flatten() });
    return;
  }
  const action = parsed.data;

  try {
    // Serialized with the bot runner so both always act on fresh state.
    await withMatchLock(id, async () => {
      const [member, matchData, engineState] = await Promise.all([
        isMatchPlayer(id, userId),
        getMatchWithPlayers(id),
        loadEngineState(id),
      ]);

      if (!member) {
        res.status(403).json({ error: "Not a member of this match" });
        return;
      }
      if (!matchData) {
        res.status(404).json({ error: "Match not found" });
        return;
      }
      if (matchData.match.status !== "in_progress") {
        res.status(400).json({ error: `Match is not in progress (status: ${matchData.match.status})` });
        return;
      }
      if (!engineState) {
        res.status(400).json({ error: "Match state is missing" });
        return;
      }

      const result = dispatchAction(engineState, userId, action);
      if (!result.ok) {
        req.log.warn(
          {
            matchId: id,
            userId,
            actionType: action.type,
            action,
            phase: engineState.phase,
            activePlayerId: engineState.activePlayerId,
            rejectionReason: result.error,
          },
          "Game action rejected by engine",
        );
        res.status(422).json({ error: result.error });
        return;
      }

      const newState = result.value;
      const bots = botUserIds(matchData);
      const myView = buildPlayerView(newState, userId, bots);
      const winner = await applyResultAndBroadcast(id, userId, action, newState, bots);

      if (winner !== undefined) {
        res.json({ ok: true, phase: newState.phase, state: myView, winnerUserId: winner });
      } else {
        res.json({ ok: true, phase: newState.phase, state: myView });
      }

      // If the action handed priority to the AI opponent, let it respond —
      // and note the human activity so the bot's interrupts react to plays
      // rather than firing at turn start.
      markHumanActivity(id, newState.turnNumber);
      kickBotRunner(id, bots);
    });
  } catch (err) {
    req.log.error({ err }, "Failed to process action");
    res.status(500).json({ error: "Failed to process action" });
  }
});

router.get("/:id/state", async (req: Request, res: Response) => {
  const userId = req.user!.internalUserId;
  const { id } = req.params as { id: string };

  try {
    const [data, engineState] = await Promise.all([
      getMatchWithPlayers(id),
      loadEngineState(id),
    ]);

    if (!data || !data.players.some((p) => p.userId === userId)) {
      res.status(403).json({ error: "Not a member of this match" });
      return;
    }
    if (!engineState) {
      res.status(400).json({ error: "Match has not started yet" });
      return;
    }

    const view = buildPlayerView(engineState, userId, botUserIds(data));
    res.json({ state: view });
  } catch (err) {
    req.log.error({ err }, "Failed to get match state");
    res.status(500).json({ error: "Failed to get match state" });
  }
});

router.post("/:id/abandon", async (req: Request, res: Response) => {
  const userId = req.user!.internalUserId;
  const { id } = req.params as { id: string };

  try {
    const data = await getMatchWithPlayers(id);
    if (!data) {
      res.status(404).json({ error: "Match not found" });
      return;
    }
    if (data.match.status === "finished") {
      res.status(409).json({ error: "Match is already finished" });
      return;
    }

    const member = await isMatchPlayer(id, userId);
    if (!member) {
      res.status(403).json({ error: "You are not a participant in this match" });
      return;
    }

    await finishMatch(id, null);

    const playerIds = data.players.map((p) => p.userId);
    for (const pid of playerIds) {
      sendToUser(id, pid, { type: "game_over", winnerUserId: null, state: null });
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to abandon match");
    res.status(500).json({ error: "Failed to abandon match" });
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

    const newMatchId = await createRematch(id);

    // Vs-AI rematches skip the waiting room: start immediately and wake the bot.
    const botIds = botUserIds(data);
    if (botIds.length > 0) {
      const started = await initializeAndStartMatch(newMatchId);
      if (!started.ok) {
        req.log.error({ matchId: newMatchId, error: started.error }, "Failed to start vs-AI rematch");
        res.status(500).json({ error: "Failed to start rematch" });
        return;
      }
      kickBotRunner(newMatchId, botIds);
    }

    broadcastToMatch(id, { type: "rematch", matchId: newMatchId });

    res.json({ ok: true, matchId: newMatchId });
  } catch (err) {
    req.log.error({ err }, "Failed to initiate rematch");
    res.status(500).json({ error: "Failed to initiate rematch" });
  }
});

export default router;
