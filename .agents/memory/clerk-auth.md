---
name: Clerk auth migration
description: Auth system replaced from Replit OIDC to Clerk. Key patterns for API and mobile.
---

# Clerk Auth Migration

## Mobile user identity — critical pattern
`useAuth().user.id` must be the **internal UUID** from `usersTable`, NOT Clerk's `userId`.
`ClerkAuthBridge` in `lib/auth.tsx` fetches `/api/auth/me` after sign-in to hydrate the
internal UUID. Game screens compare `user.id` against match/player `userId` fields.

**Why:** Game logic and match tables use UUID foreign keys from `usersTable`. Using Clerk's
user ID directly would break host detection, winner checks, and all player identity comparisons.

## How the Clerk token reaches the API
`setAuthTokenGetter(() => getToken())` is called inside `ClerkAuthBridge` via `useEffect`
whenever the Clerk `getToken` reference changes. The api-client-react `customFetch` picks
this up automatically for every API call.

## WS authentication
`src/ws/manager.ts` calls `clerkClient.verifyToken(token)` where the token comes from the
`bearer-<token>` WebSocket subprotocol. On first connection, the Clerk userId is upserted
into `usersTable` to get an internal UUID.

## Clerk management status: EXTERNAL (user's own Clerk instance)
History: external → Replit-managed (whitelabel) → back to external (July 2026). The
Replit-managed setup (FAPI proxy at `/api/__clerk`, `publishableKeyFromHost`, mobile fetch
interceptor, `EXPO_PUBLIC_CLERK_PROXY_URL` in build.js) has been fully removed. Both API
and mobile read the user's `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` directly from env.

**Why:** User wants production to authenticate against their own Clerk instance.
**How to apply:** Do NOT reintroduce proxy/whitelabel wiring or call
`setupClerkWhitelabelAuth()` unless the user explicitly asks to migrate back. If a managed
Clerk app still exists in the Auth pane, publishing may swap keys — it must be deleted via
Auth pane → Configure → Delete Clerk app. The user's Clerk dashboard must allow the
production origin for cross-origin flows. Note: `@clerk/clerk-expo` v2 silently ignores
`proxyUrl` on native builds — relevant only if a proxy setup ever returns.

## Instances, domains, and where each key lives (Oct 2026)
Both instances belong to the "Mage Card Game" application in the **client's Clerk
account** (dashboard.clerk.com), confirmed by the user 2026-10-08. That is the intended
owner. The only goal is "no Replit-managed Clerk"; do not move the app to another account.

| Use | Clerk instance | Frontend API host | Keys live in |
|---|---|---|---|
| Development | "Mage Card Game" dev instance (app id `aac_3H5T5liWQtfjRkulmH1fLSVGP7c`) | `neat-fly-47.clerk.accounts.dev` | Replit **workspace** secrets `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` (pk_test/sk_test); eas.json `development` profile env (pk only) |
| Production | Production instance of the same Clerk app | `clerk.magecardgame.com` (CNAME, like TallyBill's `clerk.tallybill.app`) | Replit **deployment** secrets, **unsynced** from workspace (pk_live/sk_live); eas.json `base` env (pk only) |

The live publishable key is deterministic: `pk_live_` + unpadded base64 of
`clerk.magecardgame.com$` = `pk_live_Y2xlcmsubWFnZWNhcmRnYW1lLmNvbSQ`. If the production
domain ever changes, eas.json `base` must change with it.

**Guards (ported from TallyBill):**
- `artifacts/api-server/src/lib/clerkKeyValidation.ts` → `assertClerkKeysForProduction`,
  called at the top of `app.ts`. With `NODE_ENV=production` (set in
  `.replit-artifact/artifact.toml`) the server exits on missing, swapped, or `*_test_` keys.
- `artifacts/mobile/scripts/build.js` (the Replit publish build) aborts unless the
  publishable key starts with `pk_live_`.
- Consequence: **republishing on Replit fails until the deployment secrets hold the live
  pair.** That is on purpose — before this, the published app shipped the dev instance.

**Native OAuth redirects** must be allowlisted on BOTH instances (Dashboard → SSO redirect
URLs, or Backend API `POST /v1/redirect_urls`). `useOAuth` uses
`makeRedirectUri({ path: "oauth-native-callback" })`, so the list is:
`magecardgame://oauth-native-callback` (dev and store builds),
`exp://mage-card-game.replit.app/ios/--/oauth-native-callback` and
`exp://mage-card-game.replit.app/android/--/oauth-native-callback` (published static build;
hostUri comes from the build.js manifest rewrite), plus the Replit dev
`exp://<REPLIT_EXPO_DEV_DOMAIN>/--/oauth-native-callback` on the dev instance (re-add if
that domain changes). Dev does not enforce the list;
production does.

**Testing sign-in:** pre-create a `something+clerk_test@example.com` user via Backend API
`POST https://api.clerk.com/v1/users` with the dev `sk_test`; email code is `424242`.
Sign-up has a Turnstile captcha, so don't automate sign-up.

## Env var forwarding
The mobile dev script in `artifacts/mobile/package.json` forwards
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY` at startup so Metro inlines it.

## sessions table
`sessionsTable` removed from Drizzle schema but the physical Postgres table still exists.
Needs a drop migration (separate follow-up task).
