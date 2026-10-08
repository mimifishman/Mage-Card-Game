---
name: Expo development build (Expo Go no longer works)
description: Expo Go only ships the newest SDK, so this SDK 54 app runs on a phone/simulator via an EAS development build. Identity, profiles, and Clerk lessons carried over from TallyBill.
---

**Why:** Expo Go on iOS only supports the newest Expo SDK (57 as of Sep 2026), so it can't
open this SDK 54 project. A development build (`expo-dev-client`) is pinned to the
project's own SDK and replaces Expo Go for day-to-day testing. TallyBillMobile hit the same
wall and solved it this way (its commits dee17a2 / 76428d4 / 0018033).

**Setup (Oct 2026):**
- `expo-dev-client ~6.0.21` (the SDK 54 version). Upgrading the SDK is a separate, larger job.
- App identity: scheme `magecardgame`, iOS bundle id / Android package `com.magecardgame`.
  The old scheme `mobile` collided with TallyBill's.
- `app.config.js`: when `APP_VARIANT=development` (set by the eas.json `development`
  profile), the app is named "Mage Card Game Dev" and the ids get a `.dev` suffix, so it can
  sit next to a store build. With APP_VARIANT unset, nothing changes.
- `eas.json` profiles: `development` (phone, internal distribution) and
  `development-simulator` (iOS Simulator .app). There are no preview/production profiles yet,
  because no production Clerk key exists to bake in.
- The dev build loads JS from Metro (the Replit `dev` script), so EXPO_PUBLIC_* come from
  that script, not from eas.json.
- `eas init` (needs the user's Expo login) writes `extra.eas.projectId` + `owner` into
  app.json. Commit that when it happens.

**Lessons from TallyBill to apply here:**
- EXPO_PUBLIC_* values are inlined at bundle time. A store/preview build with no
  `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` crashes on launch (TallyBill's first TestFlight did).
  Put the publishable key (never the secret key) in an eas.json `base` env before adding
  preview/production profiles.
- Production Clerk needs a custom domain the user owns (TallyBill: `clerk.tallybill.app`
  CNAME). A `*.replit.app` production instance can't verify DNS (see clerk-signin-diagnostics.md).
- Self-owned Clerk instances must allowlist native OAuth redirects (`magecardgame://…`
  and `exp://…/--/…`). Dev instances don't enforce this; production does.
- If Mage moves from `@clerk/clerk-expo` 2.x (deprecated) to `@clerk/expo`, use >= 4.0.0
  (3.5–3.7 crash on Android; < 3.4 breaks useSSO under Metro) and add `"@clerk/expo"` to
  app.json plugins (iOS 17 minimum), or pod install fails.
- Mobile react must exactly equal RN's renderer (19.1.0 on RN 0.81). Never bump it to quiet
  Clerk peer warnings.
- `tsc` passing doesn't prove the bundle builds. Run `expo export --platform ios` after
  dependency or config changes.
