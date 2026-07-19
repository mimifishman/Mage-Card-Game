import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { verifyToken } from "@clerk/backend";
import type { AuthSession } from "../auth";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { loadEngineState, isMatchPlayer, getActiveMatchForUser, getMatchWithPlayers } from "../repositories/matchRepository";
import { isBotProviderId } from "../repositories/botRepository";
import { buildPlayerView } from "../game/serializer";
import { logger } from "../lib/logger";

export interface WsClient {
  ws: WebSocket;
  userId: string;
  matchId: string | null;
}

const clients = new Map<WebSocket, WsClient>();
const matchRooms = new Map<string, Set<WebSocket>>();

export function createWsServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/ws",
    handleProtocols: (protocols: Set<string>) => {
      for (const proto of protocols) {
        if (proto.startsWith("bearer-")) return proto;
      }
      return false;
    },
  });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    handleConnection(ws, req).catch((err) => {
      logger.warn({ err }, "WS connection error");
      ws.close(1011, "Internal error");
    });
  });

  return wss;
}

async function handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
  const session = await resolveSession(req);
  if (!session) {
    ws.close(1008, "Unauthorized");
    return;
  }

  const client: WsClient = { ws, userId: session.internalUserId, matchId: null };
  clients.set(ws, client);

  ws.on("message", (raw) => {
    handleMessage(ws, client, raw.toString()).catch((err) => {
      logger.warn({ err }, "WS message error");
    });
  });

  ws.on("close", () => {
    if (client.matchId) {
      leaveRoom(ws, client.matchId);
    }
    clients.delete(ws);
  });

  ws.send(JSON.stringify({ type: "connected", userId: session.internalUserId }));

  const urlParams = new URLSearchParams(req.url?.split("?")[1] ?? "");
  const matchId = urlParams.get("matchId");
  if (matchId) {
    await authorizedJoinAndReconnect(ws, client, matchId);
  } else {
    await bootstrapActiveMatch(ws, client);
  }
}

async function resolveSession(req: IncomingMessage): Promise<AuthSession | null> {
  let token: string | undefined;

  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else {
    const protocols = (req.headers["sec-websocket-protocol"] ?? "") as string;
    for (const proto of protocols.split(",").map((s) => s.trim())) {
      if (proto.startsWith("bearer-")) {
        token = proto.slice("bearer-".length);
        break;
      }
    }
  }

  if (!token) return null;

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    const clerkUserId = payload.sub;

    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.providerUserId, clerkUserId))
      .limit(1);

    if (existing) {
      return {
        providerUserId: existing.providerUserId,
        displayName: existing.displayName,
        internalUserId: existing.id,
      };
    }

    const displayName =
      (payload["username"] as string | undefined) ||
      (payload["email"] as string | undefined)?.split("@")[0] ||
      clerkUserId;

    const [user] = await db
      .insert(usersTable)
      .values({ providerUserId: clerkUserId, displayName })
      .returning();

    return {
      providerUserId: user.providerUserId,
      displayName: user.displayName,
      internalUserId: user.id,
    };
  } catch {
    return null;
  }
}

function joinRoom(ws: WebSocket, client: WsClient, matchId: string): void {
  if (client.matchId && client.matchId !== matchId) {
    leaveRoom(ws, client.matchId);
  }
  client.matchId = matchId;
  if (!matchRooms.has(matchId)) {
    matchRooms.set(matchId, new Set());
  }
  matchRooms.get(matchId)!.add(ws);
}

async function authorizedJoinAndReconnect(ws: WebSocket, client: WsClient, matchId: string): Promise<boolean> {
  const member = await isMatchPlayer(matchId, client.userId);
  if (!member) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "error", error: "Not a member of this match" }));
    }
    return false;
  }
  joinRoom(ws, client, matchId);
  await pushCurrentState(ws, client.userId, matchId);
  void wakeBotIfStuck(matchId);
  return true;
}

/**
 * Recovery: if the server restarted while the AI opponent held priority, no
 * human action can re-trigger the bot runner (it isn't the human's turn), so
 * a reconnect is the natural place to wake it. No-ops for bot-free matches
 * and when it isn't the bot's turn.
 */
async function wakeBotIfStuck(matchId: string): Promise<void> {
  try {
    const data = await getMatchWithPlayers(matchId);
    if (!data || data.match.status !== "in_progress") return;
    const botIds = data.players
      .filter((p) => isBotProviderId(p.providerUserId))
      .map((p) => p.userId);
    if (botIds.length === 0) return;
    const { kickBotRunner } = await import("../bot/runner");
    kickBotRunner(matchId, botIds);
  } catch (err) {
    logger.warn({ err, matchId }, "Failed to wake bot runner on reconnect");
  }
}

async function bootstrapActiveMatch(ws: WebSocket, client: WsClient): Promise<void> {
  try {
    const matchId = await getActiveMatchForUser(client.userId);
    if (matchId) {
      joinRoom(ws, client, matchId);
      await pushCurrentState(ws, client.userId, matchId);
    }
  } catch (err) {
    logger.warn({ err }, "Failed to bootstrap active match on reconnect");
  }
}

async function pushCurrentState(ws: WebSocket, userId: string, matchId: string): Promise<void> {
  try {
    const engineState = await loadEngineState(matchId);
    if (engineState && ws.readyState === WebSocket.OPEN) {
      const view = buildPlayerView(engineState, userId);
      ws.send(JSON.stringify({ type: "reconnect_state", state: view }));
    }
  } catch (err) {
    logger.warn({ err, matchId }, "Failed to send reconnect state");
  }
}

function leaveRoom(ws: WebSocket, matchId: string): void {
  const room = matchRooms.get(matchId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) matchRooms.delete(matchId);
  }
}

async function handleMessage(ws: WebSocket, client: WsClient, raw: string): Promise<void> {
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
    return;
  }

  if (typeof msg !== "object" || msg === null) return;
  const { type, matchId } = msg as Record<string, unknown>;

  if (type === "join_match" && typeof matchId === "string") {
    const success = await authorizedJoinAndReconnect(ws, client, matchId);
    if (success && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "joined_match", matchId }));
    }
  }
}

export function broadcastToMatch(matchId: string, payload: unknown): void {
  const room = matchRooms.get(matchId);
  if (!room) return;
  const data = JSON.stringify(payload);
  for (const ws of room) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

export function sendToUser(matchId: string, userId: string, payload: unknown): void {
  const room = matchRooms.get(matchId);
  if (!room) return;
  const data = JSON.stringify(payload);
  for (const ws of room) {
    const client = clients.get(ws);
    if (client?.userId === userId && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

export function getConnectedUserIds(matchId: string): string[] {
  const room = matchRooms.get(matchId);
  if (!room) return [];
  const ids: string[] = [];
  for (const ws of room) {
    const client = clients.get(ws);
    if (client && ws.readyState === WebSocket.OPEN) ids.push(client.userId);
  }
  return ids;
}
