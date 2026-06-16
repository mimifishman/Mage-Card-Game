---
name: Clerk sign-in failure diagnostics
description: How to diagnose Clerk email/password sign-in failures (esp. needs_client_trust) on the external Clerk instance
---

When mobile sign-in fails with a non-`complete` status, identify the exact status before changing code. Two distinct causes look similar:

- **`needs_client_trust`** — password was accepted; Clerk requires the NEW DEVICE to prove itself via a **first-factor** email code (NOT second factor). Client Trust auto-enables for Clerk apps created after 2025-11-14: signing in from a fresh device emails a one-time code. Handle in-app: find `email_code` in `supportedFirstFactors`, call `signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId })`, collect code, then `signIn.attemptFirstFactor({ strategy: "email_code", code })` + `setActive`. Only triggers once per new (untrusted) device. **Critical:** this is first-factor, not second — using prepareSecondFactor/attemptSecondFactor silently fails.
- **`needs_second_factor`** — standard MFA. Use `supportedSecondFactors`, `prepareSecondFactor`, `attemptSecondFactor`.
- **First factor genuinely unavailable** — confirm by querying the live instance config, not by guessing bot protection or token caching.

**Why dev preview works but Expo published app fails:** the dev browser/simulator is already in Clerk's "trusted clients" list; fresh Expo installs on real devices are always untrusted → always trigger `needs_client_trust`. The bug was using second-factor methods for a first-factor flow.

**Diagnostic query:** decode the publishable key (`pk_test_<base64>` → base64-decode → strip trailing `$` → frontend API host) and GET `https://<frontendApi>/v1/environment?_clerk_js_version=5.0.0`. Inspect `user_settings.attributes` (each shows `enabled` / `used_for_first_factor`) and `display_config.captcha_provider`. Note: `password.used_for_first_factor` can read `false` in this payload even when password sign-in works — don't conclude password is disabled from that field alone.

**How to apply:** For any "can't sign in on real device" report, check the returned `status` first. If `needs_client_trust`, fix is first-factor email code in app code. `needs_client_trust` must be cast to string in TypeScript (SDK types lag the runtime value). Re-provisioning a Clerk instance resets sign-in config — re-verify `/v1/environment` after any key rotation.

## Published Expo app: slow load + EVERY login fails = baked key points at a dead instance

The Clerk publishable key is **baked into the published Expo bundle at build time** (build.js maps `CLERK_PUBLISHABLE_KEY` → `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`). The live published app uses whatever key was set *when it was last published*, NOT the current workspace secret. So the workspace and the published app can be on different Clerk instances.

**Symptom:** published app hangs on the login screen (Clerk JS retrying/timing out) then fails for ALL methods (Google + email), while server logs show nothing (it never reaches the backend) and the dev preview works fine.

**Root cause seen here:** the published bundle had a `pk_live` key for a production custom-domain instance (`clerk.<app>.replit.app`) whose frontend API was unreachable (DNS/TLS fails, `curl` returns HTTP 000) — the production instance was deleted or its domain never finished provisioning. Meanwhile the workspace had a healthy `pk_test` dev instance.

**Diagnose:** fetch the live bundle and compare its baked Clerk host to the workspace key host. Get the manifest with `curl -H "expo-platform: ios" https://<deploy-domain>/<basePath>/` → read `launchAsset.url` → `curl` that bundle → `grep -oE 'pk_(test|live)_[A-Za-z0-9]+'` → decode (`cut -d_ -f3- | base64 -d | tr -d '$'`) to get the frontend host. Then `curl https://<that-host>/v1/environment` — HTTP 000/timeout means the baked instance is dead.

**Fix:** re-publish so the current healthy key bakes into the app. A checkpoint **rollback does NOT fix this** — secrets aren't in checkpoints and the live deployment isn't rebuilt by a rollback; only re-publishing rebuilds the bundle.

### Why re-publishing alone may NOT change the baked key: deployment-secret override

Deployment (production) secrets are a **separate store** from workspace secrets. By default each deployment secret **auto-syncs** from the matching workspace secret, but it can be **"unsynced" (overridden)** to a pinned value. If `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` were unsynced and pinned to `pk_live`/`sk_live` (a dead/external production instance), every publish keeps baking the pinned live key even though the workspace holds healthy `pk_test`/`sk_test`. This presents to the user as "the keys revert to a linked live key on publish."

**Fix path (external Clerk, want it working on test keys):** Publishing tool → **Overview** tab → **Edit Commands and Secrets** → for both Clerk secrets, **re-sync** them to the workspace values (remove the override), or set the override to the `pk_test`/`sk_test` values → **Republish**. Both the mobile publishable key (baked into the bundle) and the api-server `CLERK_SECRET_KEY` must be the **same** test instance pair, or tokens fail to verify (401).

**Note on external Clerk production instances:** a Clerk *production* instance on a `*.replit.app` domain (e.g. `clerk.<app>.replit.app`) can't be DNS-verified (you can't add CNAME records to a replit.app domain), so its Frontend API never resolves. Real production needs a custom domain the user owns. Dev/test instances (`*.clerk.accounts.dev`) work on any domain with no DNS.
