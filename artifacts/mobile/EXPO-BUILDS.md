# Make the Expo builds (quick steps)

There are two iPhone apps:

| App | Profile | Uses |
|---|---|---|
| **Mage Card Game** (test app) | `preview` | live server, live database |
| **Mage Card Game Dev** (dev app) | `development` | Replit dev server, dev database |

For the full details (new iPhones, signing files, yearly renewal), see
[IOS-BUILDS.md](IOS-BUILDS.md).

## Once only: set up the Mac

1. Open Terminal.
2. Turn on Node 24:

   ```bash
   eval "$(fnm env)"; fnm use 24
   ```

3. Check you are logged in to Expo. It must say `mimifishman`:

   ```bash
   npx eas-cli@latest whoami
   ```

   If it does not, log in:

   ```bash
   npx eas-cli@latest login
   ```

## Step 1: get clean code

Always build from the newest `master`, with no local changes. Expo uploads the
folder exactly as it is.

```bash
cd /Users/mimifishman/Work/AIApps/Mage-Card-Game
git fetch origin
git worktree add ../mage-build origin/master
cd ../mage-build/artifacts/mobile
```

If `../mage-build` already exists, update it instead:

```bash
cd /Users/mimifishman/Work/AIApps/mage-build
git fetch origin
git checkout --detach origin/master
cd artifacts/mobile
```

## Step 2: start the build

Test app (preview):

```bash
npx eas-cli@latest build --platform ios --profile preview
```

Dev app (development):

```bash
npx eas-cli@latest build --platform ios --profile development
```

- If it asks "Do you want to log in to your Apple account?", answer **No**.
  Expo already has the signing files.
- The build runs on Expo's computers. It takes about 15 minutes.
- You can close the Terminal. The build keeps going.

## Step 3: install on the iPhone

1. Open https://expo.dev/accounts/mimifishman/projects/mage-card-game/builds
2. Click the new build. Check the **Profile** says `preview` or `development`.
3. On the iPhone, open that build page in **Safari** (scan the QR code).
4. Tap **Install**.
5. First time only: on the iPhone, go to
   **Settings → Privacy & Security → Developer Mode** and turn it on.

## Step 4 (dev app only): connect to the dev server

1. Open the Mage project on Replit. It must stay open.
2. In the **Workflows** tab, make sure these two run:
   - `artifacts/mobile: expo`
   - `artifacts/api-server: API Server`
3. Open **Mage Card Game Dev** on the iPhone.
4. Enter this URL:
   `https://99f11984-d608-4ef4-b532-be1cd634f14f-00-2uu2xbdtqoihl.expo.riker.replit.dev`

## When do I need a new build?

| Change | Test app | Dev app |
|---|---|---|
| Normal code change | new build | no build, it reloads |
| New native package, `app.json`, Expo SDK | new build | new build |
| New iPhone | see IOS-BUILDS.md | see IOS-BUILDS.md |

## If something goes wrong

- **Dev app says "Failed to connect"**: Replit went to sleep. Open the project
  on Replit and run the two workflows again.
- **"Install" does nothing, or the app will not open**: the iPhone is not on the
  list of allowed phones. See "Add another iPhone" in IOS-BUILDS.md.
- **The Builds page shows only one app**: clear the filters, or pick "All" profiles.
