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

## Env var forwarding
The mobile dev script in `artifacts/mobile/package.json` forwards
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=$CLERK_PUBLISHABLE_KEY` at startup so Metro inlines it.

## sessions table
`sessionsTable` removed from Drizzle schema but the physical Postgres table still exists.
Needs a drop migration (separate follow-up task).
