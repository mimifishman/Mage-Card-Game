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
  clearSessionCookie,
  type SessionRecord,
} from "../session";

const ISSUER_URL = process.env.ISSUER_URL ?? "https://replit.com/oidc";
const SESSION_COOKIE = "sid";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OIDC_COOKIE_TTL_MS = 10 * 60 * 1000;

let _oidcConfig: oidc.Configuration | null = null;

async function getOidcConfig(): Promise<oidc.Configuration> {
  if (!_oidcConfig) {
    _oidcConfig = await oidc.discovery(
      new URL(ISSUER_URL),
      process.env.REPL_ID!,
    );
  }
  return _oidcConfig;
}

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host =
    req.headers["x-forwarded-host"] ?? req.headers["host"] ?? "localhost";
  return `${proto}://${host}`;
}

function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  return value;
}

function setOidcCookie(res: Response, name: string, value: string): void {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL_MS,
  });
}

function setSessionCookie(res: Response, sid: string): void {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

async function upsertUser(
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

  async handleLogin(req: Request, res: Response): Promise<void> {
    const config = await getOidcConfig();
    const callbackUrl = `${getOrigin(req)}/api/auth/callback`;
    const returnTo = getSafeReturnTo(req.query.returnTo);

    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    const redirectTo = oidc.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl,
      scope: "openid email profile offline_access",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "login consent",
      state,
      nonce,
    });

    setOidcCookie(res, "code_verifier", codeVerifier);
    setOidcCookie(res, "nonce", nonce);
    setOidcCookie(res, "state", state);
    setOidcCookie(res, "return_to", returnTo);

    if (req.query.web_mobile === "1") {
      res.cookie("web_mobile", "1", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: OIDC_COOKIE_TTL_MS,
      });
    }

    res.redirect(redirectTo.href);
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

    const isWebMobile = req.cookies?.web_mobile === "1";
    const returnTo = getSafeReturnTo(req.cookies?.return_to);
    res.clearCookie("code_verifier", { path: "/" });
    res.clearCookie("nonce", { path: "/" });
    res.clearCookie("state", { path: "/" });
    res.clearCookie("return_to", { path: "/" });
    res.clearCookie("web_mobile", { path: "/" });

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
    setSessionCookie(res, sid);

    if (isWebMobile && process.env.REPLIT_EXPO_DEV_DOMAIN) {
      res.redirect(`https://${process.env.REPLIT_EXPO_DEV_DOMAIN}/?session_token=${sid}`);
    } else {
      res.redirect(returnTo);
    }
  }

  async handleLogout(req: Request, res: Response): Promise<void> {
    const config = await getOidcConfig();
    const origin = getOrigin(req);
    const sid = getSessionIdFromRequest(req);

    if (sid) {
      await deleteSession(sid);
    }
    clearSessionCookie(res);

    const endSessionUrl = oidc.buildEndSessionUrl(config, {
      client_id: process.env.REPL_ID!,
      post_logout_redirect_uri: origin,
    });

    res.redirect(endSessionUrl.href);
  }

  async handleMobileTokenExchange(req: Request, res: Response): Promise<void> {
    const { code, code_verifier, redirect_uri, state, nonce } = req.body ?? {};

    if (!code || !code_verifier || !redirect_uri || !state) {
      res.status(400).json({ error: "Missing required parameters" });
      return;
    }

    try {
      const config = await getOidcConfig();
      const callbackUrl = new URL(redirect_uri as string);
      callbackUrl.searchParams.set("code", code as string);
      callbackUrl.searchParams.set("state", state as string);
      callbackUrl.searchParams.set("iss", ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier as string,
        expectedNonce: nonce ?? undefined,
        expectedState: state as string,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
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
      res.json({ token: sid });
    } catch (err) {
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  }

  async handleMobileLogout(req: Request, res: Response): Promise<void> {
    const sid = getSessionIdFromRequest(req);
    if (sid) {
      await deleteSession(sid);
    }
    res.json({ success: true });
  }
}
