---
name: orval codegen requires rebuilding project-reference dist
description: After running orval codegen, mobile/consumer tsc reads stale dist/*.d.ts unless the api-client-react / api-zod project references are rebuilt.
---

`lib/api-client-react` and `lib/api-zod` are consumed as TypeScript **project references**
(see `references` in `artifacts/mobile/tsconfig.json` and root `tsconfig.json`). tsc reads
their built `dist/*.d.ts`, NOT the `src/generated` output — even though the package
`exports` map points runtime at `./src/index.ts`.

**Why:** After editing `openapi.yaml` and running codegen (`pnpm --filter @workspace/api-spec run codegen`),
`src/generated` updates but `dist` stays stale. Mobile `tsc --noEmit` then reports phantom
errors (missing new fields/enums AND seemingly-unrelated "pre-existing" errors like
`useGetMyMatches` / `displayName` not found) — all symptoms of stale declaration files.

**How to apply:** After any orval codegen run, rebuild the references before typechecking
consumers: `npx tsc -b lib/api-client-react lib/api-zod` (there is no `build` npm script;
the packages are composite and built via `tsc -b`). Then `cd artifacts/mobile && npx tsc --noEmit`
should be clean. Clearing `tsconfig.tsbuildinfo` alone does not help.
