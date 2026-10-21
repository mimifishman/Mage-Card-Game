# iPhone test builds (Mage Card Game)

How to put Mage on a real iPhone without the App Store. There are two apps. They can
sit side by side on one phone.

| | **Mage Card Game** (test app) | **Mage Card Game Dev** (dev app) |
|---|---|---|
| EAS profile | `preview` | `development` |
| Bundle ID | `com.magecardgame` | `com.magecardgame.dev` |
| Code | built into the app | loaded live from the Replit dev server |
| Server + database | live (`mage-card-game.replit.app`) | dev (Replit workspace) |
| Clerk | production (`clerk.magecardgame.com`) | development (`neat-fly-47`) |
| New code needs | a new build (~15 min) | nothing, it reloads |

Both are **Ad Hoc** builds. They install only on iPhones listed in their profile.

## Accounts and where things live

- **Apple team:** client team `LN6694N33Y` (Jason Kipp, Account Holder). App IDs
  `com.magecardgame` and `com.magecardgame.dev`.
- **Expo project:** `@mimifishman/mage-card-game`. Expo stores the signing files
  (distribution certificate + one Ad Hoc profile per app). Nobody needs to sign in to
  Apple for a normal build.
- **Apple key for signing work:** App Store Connect team key **Expo Admin**, Key ID
  `5B6UHLK7V9`, Issuer ID `3f026ab2-defe-4d4a-b2ad-8383ce691847`, access **Admin**. The
  `.p8` file is at `~/.appstoreconnect/private_keys/AuthKey_5B6UHLK7V9.p8` (mode 600) on
  Mimi's Mac, with a copy in her password manager. Never in git. With it, EAS registers
  devices, regenerates Ad Hoc profiles and creates certificates without anyone's Apple
  login (needed because team `LN6694N33Y` is an Individual account, so Mimi cannot be
  added to Certificates, IDs & Profiles). Tested read-only on 21 Oct 2026: it lists the
  team's certificate, devices and profiles.
- **Apple key for uploads:** team key **Expo**, Key ID `VV4G7U8U8C`, **App Manager**,
  stored on Expo for EAS Submit. App Manager keys cannot touch certificates, profiles or
  devices.
- **Distribution certificate:** "Apple Distribution: Jason Kipp (LN6694N33Y)", ID
  `ZX5MP79KN7`. It **expires on 11 Oct 2027**. Apple does not make longer ones; see
  "Yearly renewal" below.
- Never commit signing files. `artifacts/mobile/.gitignore` already ignores
  `credentials.json`, `*.p12`, `*.p8`, `*.key` and `*.mobileprovision`.

Always build from a **clean checkout of `master`** (a worktree), never from a folder with
local changes. EAS uploads the working tree as it is.

## Build and install the test app

```bash
cd artifacts/mobile
npx eas-cli@latest build --platform ios --profile preview
```

When it finishes, open the build page on the iPhone in Safari and tap **Install**.
iOS 16+: turn on **Settings → Privacy & Security → Developer Mode** once.

## Build and install the dev app

```bash
cd artifacts/mobile
npx eas-cli@latest build --platform ios --profile development
```

Install it the same way. To use it:

1. Open the Mage repl on Replit so it is awake.
2. Make sure the **artifacts/mobile: expo** and **artifacts/api-server: API Server**
   workflows are running (Workflows tab → Run).
3. Open **Mage Card Game Dev** on the iPhone and enter this URL:
   `https://99f11984-d608-4ef4-b532-be1cd634f14f-00-2uu2xbdtqoihl.expo.riker.replit.dev`

You only need to rebuild the dev app when native parts change (new native packages,
`app.json`, Expo SDK).

**Check what the dev code points to.** This prints the Clerk instance the dev server
inlines. It must be `neat-fly-47`, never `clerk.magecardgame.com`:

```bash
E=https://99f11984-d608-4ef4-b532-be1cd634f14f-00-2uu2xbdtqoihl.expo.riker.replit.dev
U=$(curl -s -H "expo-platform: ios" "$E/" | python3 -c "import json,sys;print(json.load(sys.stdin)['launchAsset']['url'])")
curl -s "$U" | grep -oE 'pk_(test|live)_[A-Za-z0-9]{20,}' | sort -u
```

## Turn on the Apple key

EAS uses an App Store Connect API key instead of an Apple login when these are set
(docs: docs.expo.dev/build/building-on-ci, "Provide an ASC API token"):

```bash
export EXPO_ASC_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_5B6UHLK7V9.p8" EXPO_ASC_KEY_ID=5B6UHLK7V9 EXPO_ASC_ISSUER_ID=3f026ab2-defe-4d4a-b2ad-8383ce691847 EXPO_APPLE_TEAM_ID=LN6694N33Y EXPO_APPLE_TEAM_TYPE=INDIVIDUAL
```

All three `EXPO_ASC_*` values are needed. Without the Issuer ID, EAS treats the key as
an individual key, and Apple blocks those from certificates, profiles and devices. Push
keys still need a real Apple login; Mage does not use push.

## Add another iPhone

A new iPhone must be on **both** Ad Hoc profiles. With the Apple key on:

1. Register it on Expo: `npx eas-cli@latest device:create` → **Website** (send the link;
   the owner installs the profile in Safari) or **Input** (paste a UDID from Finder).
   Check with `npx eas-cli@latest device:list`.
2. Rebuild with a profile refresh:

   ```bash
   npx eas-cli@latest build --platform ios --profile preview --non-interactive --refresh-ad-hoc-provisioning-profile
   ```

   Same with `--profile development` for the dev app. The refresh registers every Expo
   device on Apple, regenerates the app's Ad Hoc profile with **all** Expo devices, and
   stores it on Expo. Keep Expo's device list complete: a phone that is only on Apple's
   list drops out of the profile. (21 Oct 2026: both lists hold the same one iPhone.)
3. A device still "Processing" at Apple (up to 72 h) is skipped with a warning. Run the
   build again later.

Later website builds reuse the refreshed profile.

**Old way (needs Jason's Apple website):** register the UDID under Devices, edit both
profiles, download them, and upload them as in "Upload signing files to Expo".

## Upload signing files to Expo

Used after a profile changes or the certificate is renewed. `eas credentials` has no
non-interactive mode, so these are menu steps:

1. `cd artifacts/mobile` and download the current files:
   `npx eas-cli@latest credentials --platform ios` → profile **preview** → Apple login
   **No** → **credentials.json** → **Download credentials from EAS to credentials.json**.
   This writes `credentials.json` and `credentials/ios/`.
2. Put the new profile in `credentials/ios/` and point
   `ios.provisioningProfilePath` in `credentials.json` at it.
3. Upload: same menu → **Upload credentials from credentials.json to EAS** → **Adhoc**.
   - For the **test app**, choose profile **preview**.
   - For the **dev app**, choose profile **development** and run the command with
     `APP_VARIANT=development` in front. Without that, `eas credentials` reads the live
     bundle ID and puts the dev profile on the test app.
4. Check the output says the bundle ID you meant. Then delete `credentials.json` and
   `credentials/`.

## Yearly renewal (before 11 Oct 2027)

Apple distribution certificates last one year. About a month before expiry, with the
Apple key on (steps from eas-cli 25.3 source; not run yet, because they create a real
certificate):

1. `npx eas-cli@latest credentials --platform ios` → profile **preview** → **Build
   Credentials** → **Distribution Certificate: Add a new one to your account**. EAS
   creates it on Apple through the key and stores it. If it asks to revoke certificates,
   stop: revoking breaks every Ad Hoc build signed with that certificate at once.
   Answer **Yes** to "use the new Distribution Certificate?"; EAS makes a new Ad Hoc
   profile for `com.magecardgame`.
2. `APP_VARIANT=development npx eas-cli@latest credentials --platform ios` → profile
   **development** → **Build Credentials** → **Distribution Certificate: Use an existing
   one for your project** → pick the new certificate. Check the bundle ID says `.dev`.
3. Same as step 2 without `APP_VARIANT`, profile **production** (App Store profile).
4. Rebuild and reinstall the test and dev apps. Apps signed with the old certificate stop
   opening when it expires. App Store builds are not affected.

**Old way (no key):** make a CSR with `openssl`, create the certificate on Apple's
website, build a `.p12`, re-make the profiles and upload them as in "Upload signing
files to Expo".

## Troubleshooting

- **"not associated with Apple Team ID LN6694N33Y"**: EAS tried an Apple login. Turn on
  the Apple key in that terminal (see "Turn on the Apple key").
- **"The App Store Connect API key in use has no Issuer ID"**: `EXPO_ASC_ISSUER_ID` is
  not set.
- **Dev app shows an error or a blank screen**: the Replit workspace is asleep, or the
  mobile workflow stopped. Open the repl and run the workflows.
- **Sign-in fails in the dev app**: check the inlined key above. A dev app with the live
  Clerk key (or the live domain) breaks every request.
