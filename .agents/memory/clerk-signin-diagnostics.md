---
name: Clerk sign-in failure diagnostics
description: How to diagnose Clerk email/password sign-in failures (esp. needs_client_trust) on the external Clerk instance
---

When mobile sign-in fails with a non-`complete` status, identify the exact status before changing code. Two distinct causes look similar:

- **`needs_client_trust` / `needs_second_factor`** — the password was accepted; Clerk requires a second factor. Client Trust is auto-enabled for Clerk apps created after 2025-11-14: signing in from a NEW device emails a one-time code that must be entered as a second factor. Handle in-app (do NOT treat as a password failure): on these statuses, find the `email_code` entry in `supportedSecondFactors`, call `signIn.prepareSecondFactor({strategy:"email_code"})`, collect the code, then `signIn.attemptSecondFactor({strategy:"email_code",code})` and `setActive`. Only triggers once per new device.
- **First factor genuinely unavailable** — confirm by querying the live instance config, not by guessing bot protection or token caching.

**Diagnostic query:** decode the publishable key (`pk_test_<base64>` → base64-decode → strip trailing `$` → frontend API host) and GET `https://<frontendApi>/v1/environment?_clerk_js_version=5.0.0`. Inspect `user_settings.attributes` (each shows `enabled` / `used_for_first_factor`) and `display_config.captcha_provider` / `fraud_settings`. Note: `password.used_for_first_factor` can read `false` in this payload even when password sign-in works — Client Trust applies email_code as a SECOND factor on top of a validated password, so don't conclude password is disabled from that field alone.

**How to apply:** For any "can't sign in" report on the external Clerk instance, check the returned `status` first. If it's a client-trust/second-factor status, the fix is in app code (the second-factor handler), not the dashboard. `CLERK_PUBLISHABLE_KEY` is in the shell env (mobile dev workflow exposes it as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`). Client Trust can alternatively be toggled on the Clerk dashboard Updates page, but handling the status in-app is the robust path.
