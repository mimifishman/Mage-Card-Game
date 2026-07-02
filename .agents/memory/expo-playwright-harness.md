---
name: Expo web app + Playwright test harness limitation
description: The runTest e2e tool can fail to render this project's Expo web app (blank page) even when the app works correctly.
---

When running `runTest` (Playwright-based e2e) against the `artifacts/mobile` Expo app,
navigation to its preview path (root `/` or `/mobile/` depending on artifact layout)
has intermittently returned a completely blank page with an empty accessibility tree,
across multiple retries and multiple phrasings of the test plan.

**Why:** Confirmed via the direct `screenshot` (app_preview) tool, hitting the same
underlying URL immediately after a failed `runTest` run, that the app actually renders
correctly (login screen, buttons, etc.) with no console errors. So the blank page is a
harness/proxy-navigation issue specific to Playwright + Expo web in this environment,
not a real regression in the app.

**How to apply:** If `runTest` reports a blank page for this Expo app, don't
immediately treat it as a real bug — corroborate with a direct `screenshot`
(app_preview) call to the same path first. If the screenshot renders fine, fall back to
unit tests + typecheck + manual screenshot verification instead of blocking on e2e for
this particular app.
