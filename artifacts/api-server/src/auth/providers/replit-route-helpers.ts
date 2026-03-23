import * as oidc from "openid-client";
import { type Request, type Response } from "express";
import {
  getOidcConfig,
  getOrigin,
  getSafeReturnTo,
  upsertUser,
  ISSUER_URL,
} from "./replit";
import {
  createSession,
  deleteSession,
  getSessionIdFromRequest,
  clearSessionCookie,
  type SessionRecord,
} from "../session";

const OIDC_COOKIE_TTL_MS = 10 * 60 * 1000;

function setOidcCookie(res: Response, name: string, value: string): void {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL_MS,
  });
}

export async function handleWebLogin(
  req: Request,
  res: Response,
): Promise<void> {
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

  res.redirect(redirectTo.href);
}

export async function handleWebLogout(
  req: Request,
  res: Response,
): Promise<void> {
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

export async function handleMobileTokenExchange(
  req: Request,
  res: Response,
): Promise<void> {
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

export async function handleMobileLogout(
  req: Request,
  res: Response,
): Promise<void> {
  const sid = getSessionIdFromRequest(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json({ success: true });
}
