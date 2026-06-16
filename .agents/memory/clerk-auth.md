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

## Clerk management status: Replit-managed (migrated)
Previously external Clerk (user's own account with a dead prod instance on replit.app domain).
Migrated to Replit-managed via `setupClerkWhitelabelAuth()`. Now:
- API server has `clerkProxyMiddleware` at `/api/__clerk` (before cors/body parsers) + `clerkMiddleware` using `publishableKeyFromHost` from `@clerk/shared/keys`.
- Mobile `lib/auth.tsx` passes `proxyUrl={proxyUrl}` (from `EXPO_PUBLIC_CLERK_PROXY_URL`) to `ClerkProvider`.
- `build.js` constructs `EXPO_PUBLIC_CLERK_PROXY_URL` from `CLERK_PROXY_URL` + deploy domain.
- On publish, Replit auto-swaps test keys → live keys and sets `CLERK_PROXY_URL=/api/__clerk`.
- `CLERK_PROXY_URL` is NEVER set in dev (proxy is prod-only). Do not add it to workspace secrets.

## Critical: proxyUrl is silently ignored in @clerk/clerk-expo v2 native builds
`@clerk/clerk-expo` v2.19.31 `ClerkProvider` does NOT forward `proxyUrl` to `getClerkInstance()`
for native builds. `BuildClerkOptions` type confirms: only `publishableKey`, `tokenCache`, and two
experimental flags are accepted. `proxyUrl` lands in `...rest` spread to clerk-react's Provider but
can't affect the pre-initialized Clerk instance. The FAPI domain (`clerk.<deploy-domain>`) is thus
dead on Replit (HTTP 000).

**Fix:** A global `fetch` interceptor is installed at module level in `lib/auth.tsx` (runs before
ClerkProvider renders). It derives the dead FAPI domain from the proxy URL (`clerk.${proxyHost}`)
and redirects all matching fetch calls through the working `/api/__clerk` proxy. Only active when
`EXPO_PUBLIC_CLERK_PROXY_URL` is set (production). Dev mode unaffected (var not set in dev script,
and dev pk_test uses a different FAPI domain anyway).

**Why:** `clerk.mage-card-game.replit.app` resolves via Replit wildcard DNS but returns HTTP 000 —
Replit's infra layer doesn't route that subdomain to any service. Cannot be fixed server-side.

## Env var forwarding
The mobile dev script in `artifacts/mobile/package.json` forwards
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY` at startup so Metro inlines it.

## sessions table
`sessionsTable` removed from Drizzle schema but the physical Postgres table still exists.
Needs a drop migration (separate follow-up task).
