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

Also seen: `runTest` navigating to `/login` (or even the full explicit
`https://$REPLIT_EXPO_DEV_DOMAIN/login` URL passed directly in the test plan) instead
resolves to the project's `mockup-sandbox` design-preview server ("Component Preview
Server" page suggesting `/__mockup`), not the actual Expo app — even though a direct
`screenshot(app_preview)` or `curl` to the same domain/path returns the real app with a
200. This is the same harness/proxy-navigation limitation, just manifesting as wrong-app
routing instead of a blank page. Don't retry with slightly different URL phrasing; corroborate with
`screenshot`/`curl` directly and fall back to unit tests + typecheck + manual screenshots.
