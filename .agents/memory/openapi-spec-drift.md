---
name: OpenAPI spec drift risk
description: lib/api-spec/openapi.yaml can silently fall out of sync with the real server types, causing orval codegen to regress mobile types.
---

The hand-maintained `lib/api-spec/openapi.yaml` is the source of truth for orval codegen
(`lib/api-client-react`, `lib/api-zod`), but nothing enforces it staying in sync with the
actual server-side types (e.g. `game/types.ts`, `game/actions.ts`). It can drift silently
for a long time with no build failure, because the generated client code isn't
automatically re-diffed against server types.

**Why:** Found significant pre-existing drift (missing schemas like DuelContext/
CombatSummary/CombatPairOutcome/PendingClubDebuff, stale field names like
`blockerCardId` vs `blockerCardIds`, incomplete action-type enums) that had accumulated
over multiple past changes without anyone re-running codegen or diffing the spec.

**How to apply:** Before trusting a codegen run (or before adding a new field to
shared game/API types), diff the spec's schemas against the corresponding
TypeScript types in the api-server source. If you touch any type that's exposed
over the API, update openapi.yaml in the same change and regenerate immediately
rather than letting it drift further.

**Known current drift (as of 2026-07-28):** `PendingClubDebuff.faceDamage` (and optional
`targetRoyalId`), `GameState.blockDiamondUsedBy`, and the `royal_destroyed` LifeEvent kind
(+ `destroyedRoyalId`) exist in `game/types.ts` but NOT in `openapi.yaml`. Mobile reads
them via casts. Add them to the spec and regenerate before relying on generated types.
