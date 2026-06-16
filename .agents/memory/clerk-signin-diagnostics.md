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
