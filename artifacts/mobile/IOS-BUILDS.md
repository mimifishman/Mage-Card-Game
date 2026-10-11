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

## Add another iPhone

A new iPhone must be on **both** Ad Hoc profiles.

1. Get its UDID: run `npx eas-cli@latest device:create` → **Website**, open the QR code
   on the phone and install the profile. The Expo page then shows the UDID.
2. Register it with Apple: developer.apple.com → Certificates, IDs & Profiles →
   **Devices** → **+**.
3. Edit both profiles ("Mage Card Game Ad Hoc" and "Mage Card Game Dev Ad Hoc"):
   **Profiles** → open → **Edit** → tick the new device → **Save** → **Download**.
4. Upload each new profile to Expo (see "Upload signing files to Expo").
5. Rebuild both apps.

If an Apple sign-in in the terminal works for the person building (their Apple ID is on
team `LN6694N33Y`), `eas build` can do steps 2–4 itself: answer **Yes** to "log in to your
Apple account", with `EXPO_APPLE_TEAM_ID=LN6694N33Y` set.

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

Apple distribution certificates last one year. About a month before expiry:

1. Make a new key and certificate request on the Mac:
   `openssl genrsa -out dist.key 2048` and
   `openssl req -new -key dist.key -out dist.csr -subj "/emailAddress=jekipp@gmail.com/CN=Mage Card Game Distribution/C=US"`.
2. Apple → **Certificates** → **+** → **Apple Distribution** → upload `dist.csr` → download.
3. Make a `.p12`: convert the `.cer` to PEM, then
   `openssl pkcs12 -export -inkey dist.key -in dist.pem -out dist.p12` with a new password.
4. Edit both Ad Hoc profiles to use the new certificate, download them, and upload
   certificate + profiles to Expo as above.
5. Rebuild both apps and reinstall them. Apps signed with the old certificate stop
   opening when it expires.

## Troubleshooting

- **"not associated with Apple Team ID LN6694N33Y"**: the Apple ID used in the terminal
  is not on the client's developer team yet. Use the stored Expo credentials (no Apple
  login), or make profiles by hand in the client's browser.
- **Dev app shows an error or a blank screen**: the Replit workspace is asleep, or the
  mobile workflow stopped. Open the repl and run the workflows.
- **Sign-in fails in the dev app**: check the inlined key above. A dev app with the live
  Clerk key (or the live domain) breaks every request.
