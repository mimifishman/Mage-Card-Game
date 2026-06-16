---
name: Clerk sign-in failure diagnostics
description: How to diagnose why Clerk email/password sign-in fails on this external Clerk instance
---

When mobile sign-in fails with confusing statuses (`needs_client_trust`, "sign-in could not be completed"), do NOT guess at bot protection or token caching. Query the live Clerk instance config directly.

**Diagnostic:** decode the publishable key (`pk_test_<base64>` → base64-decode → strip trailing `$` → frontend API host) and GET `https://<frontendApi>/v1/environment?_clerk_js_version=5.0.0`. Inspect `user_settings.attributes`: each attribute shows `enabled` and `used_for_first_factor`. A method can only be used to sign IN if `used_for_first_factor=true`. Also check `display_config.captcha_provider` / `fraud_settings` to confirm whether bot protection is actually on.

**Why:** Spent multiple rounds chasing bot protection and stale token caches. Root cause was the instance only had `email_address` (email_code) as a first factor; `password.used_for_first_factor` was `false`, so password sign-in could never complete regardless of app code. The app UI is password-based, so the fix is enabling Password as a sign-in strategy in the Clerk dashboard — not app changes.

**How to apply:** For any "can't sign in" report on the external Clerk instance, run the environment query first to see which factors are actually enabled before touching app code. `CLERK_PUBLISHABLE_KEY` is available in the shell env (used by the mobile dev workflow as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`).
