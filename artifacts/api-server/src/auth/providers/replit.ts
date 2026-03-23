import * as oidc from "openid-client";
import { type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthService, AuthSession } from "../types";
import {
  createSession,
  readSession,
  deleteSession,
  updateSession,
  getSessionIdFromRequest,
  type SessionRecord,
} from "../session";

export const ISSUER_URL = process.env.ISSUER_URL ?? "https://replit.com/oidc";

let _oidcConfig: oidc.Configuration | null = null;

export async function getOidcConfig(): Promise<oidc.Configuration> {
  if (!_oidcConfig) {
    _oidcConfig = await oidc.discovery(
      new URL(ISSUER_URL),
      process.env.REPL_ID!,
    );
  }
  return _oidcConfig;
}

export function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host =
    req.headers["x-forwarded-host"] ?? req.headers["host"] ?? "localhost";
  return `${proto}://${host}`;
}

export function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  return value;
}

export async function upsertUser(
  claims: Record<string, unknown>,
): Promise<{ id: string; providerUserId: string; displayName: string }> {
  const providerUserId = claims.sub as string;
  const displayName =
    (claims.name as string) ||
    (claims.first_name as string) ||
    (claims.preferred_username as string) ||
    providerUserId;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.providerUserId, providerUserId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [user] = await db
    .insert(usersTable)
    .values({ providerUserId, displayName })
    .returning();

  return user;
}

async function tryRefreshSession(
  sid: string,
  record: SessionRecord,
): Promise<SessionRecord | null> {
  const now = Math.floor(Date.now() / 1000);
  if (!record.expires_at || now <= record.expires_at) return record;
  if (!record.refresh_token) return null;

  try {
    const config = await getOidcConfig();
    const tokens = await oidc.refreshTokenGrant(config, record.refresh_token);
    const updated: SessionRecord = {
      ...record,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? record.refresh_token,
      expires_at: tokens.expiresIn()
        ? now + tokens.expiresIn()!
        : record.expires_at,
    };
    await updateSession(sid, updated);
    return updated;
  } catch {
    return null;
  }
}

export class ReplitAuthService implements AuthService {
  async getSession(req: Request): Promise<AuthSession | null> {
    const sid = getSessionIdFromRequest(req);
    if (!sid) return null;

    const record = await readSession(sid);
    if (!record?.session) return null;

    const refreshed = await tryRefreshSession(sid, record);
    if (!refreshed) {
      await deleteSession(sid);
      return null;
    }

    return refreshed.session;
  }

  async handleCallback(req: Request, res: Response): Promise<void> {
    const config = await getOidcConfig();
    const callbackUrl = `${getOrigin(req)}/api/auth/callback`;

    const codeVerifier = req.cookies?.code_verifier;
    const nonce = req.cookies?.nonce;
    const expectedState = req.cookies?.state;

    if (!codeVerifier || !expectedState) {
      res.redirect("/api/login");
      return;
    }

    const currentUrl = new URL(
      `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
    );

    let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
    try {
      tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedNonce: nonce,
        expectedState,
        idTokenExpected: true,
      });
    } catch {
      res.redirect("/api/login");
      return;
    }

    const returnTo = getSafeReturnTo(req.cookies?.return_to);
    res.clearCookie("code_verifier", { path: "/" });
    res.clearCookie("nonce", { path: "/" });
    res.clearCookie("state", { path: "/" });
    res.clearCookie("return_to", { path: "/" });

    const claims = tokens.claims();
    if (!claims) {
      res.redirect("/api/login");
      return;
    }

    const dbUser = await upsertUser(
      claims as unknown as Record<string, unknown>,
    );

    const now = Math.floor(Date.now() / 1000);
    const record: SessionRecord = {
      session: {
        providerUserId: dbUser.providerUserId,
        displayName: dbUser.displayName,
        internalUserId: dbUser.id,
      },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiresIn()
        ? now + tokens.expiresIn()!
        : (claims.exp as number | undefined),
    };

    const sid = await createSession(record);
    res.cookie("sid", sid, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    res.redirect(returnTo);
  }
}
