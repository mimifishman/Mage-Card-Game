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

## Env var forwarding
The mobile dev script in `artifacts/mobile/package.json` forwards
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY` at startup so Metro inlines it.

## sessions table
`sessionsTable` removed from Drizzle schema but the physical Postgres table still exists.
Needs a drop migration (separate follow-up task).
