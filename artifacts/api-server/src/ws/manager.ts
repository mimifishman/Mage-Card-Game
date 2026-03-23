import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { authService } from "../auth";
import type { AuthSession } from "../auth";
import { loadEngineState } from "../repositories/matchRepository";
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
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

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
    await joinRoomAndReconnect(ws, client, matchId);
  }
}

async function resolveSession(req: IncomingMessage): Promise<AuthSession | null> {
  const authHeader = req.headers["authorization"];
  const cookieHeader = req.headers["cookie"];

  const fakeReq = {
    headers: { authorization: authHeader, cookie: cookieHeader },
    cookies: parseCookies(cookieHeader ?? ""),
  };

  try {
    return await authService.getSession(fakeReq as Parameters<typeof authService.getSession>[0]);
  } catch {
    return null;
  }
}

function parseCookies(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of cookieStr.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k) cookies[k.trim()] = decodeURIComponent(rest.join("=").trim());
  }
  return cookies;
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

async function joinRoomAndReconnect(ws: WebSocket, client: WsClient, matchId: string): Promise<void> {
  joinRoom(ws, client, matchId);

  try {
    const engineState = await loadEngineState(matchId);
    if (engineState) {
      const view = buildPlayerView(engineState, client.userId);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "reconnect_state", state: view }));
      }
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
    await joinRoomAndReconnect(ws, client, matchId);
    ws.send(JSON.stringify({ type: "joined_match", matchId }));
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
