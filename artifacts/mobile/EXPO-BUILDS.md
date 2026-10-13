# Make the iPhone apps (simple guide)

## What is going on

There are two iPhone apps. Both can be on one phone.

| | **Mage Card Game** (test app) | **Mage Card Game Dev** (dev app) |
|---|---|---|
| Expo profile | `preview` | `development` |
| Think of it as | a **printed book** | a **TV** |
| Game code | printed inside the app | sent live from Replit |
| Server and database | live | dev |
| You change the code | make a new build | nothing, it updates by itself |
| Needs Replit open | no | yes |

### The test app is a printed book

When Expo makes the test app, it:

1. Takes all the game code.
2. Adds the live settings: the live server and the live sign-in.
3. Packs it all into one app. It adds Apple's "stamp", so the iPhone trusts it.

The result is a finished app. It works alone. To change the game, you print a
new book: you make a new build (about 15 minutes).

### The dev app is a TV

When Expo makes the dev app, it packs only the **shell**. The shell is the part
that talks to the iPhone: screen, sign-in, sound. It adds a small **loader**,
not the game.

When you open the dev app, the loader gets the game code from Replit. So:

- Change the code on Replit, and the app shows the change at once.
- If Replit is asleep, the app has nothing to show ("Failed to connect").
- You make a new dev build only when the shell changes: a new package that
  talks to the iPhone, a change to `app.json`, or a new Expo version. This
  happens seldom.

---

## The easy way: websites only

You use three websites: **GitHub**, **Expo** and **Replit**. No Terminal.

### Once only: connect Expo to GitHub

This lets Expo get the code from GitHub by itself.

1. Open https://expo.dev/accounts/mimifishman/projects/mage-card-game/github
2. Install the **Expo GitHub app** when it asks. GitHub opens.
   - Pick the account **mimifishman**.
   - Choose **Only select repositories** → **Mage-Card-Game**.
   - Click **Install**.
3. Back on Expo, pick the repository **mimifishman/Mage-Card-Game**.
4. In **Base directory**, type `artifacts/mobile`. This tells Expo where the
   app is inside the project.
5. Save.

### Each time: make the test app (preview)

1. **GitHub:** make sure the changes you want are on `master`. On
   https://github.com/mimifishman/Mage-Card-Game/pulls open the pull request and
   click **Merge pull request**.
2. **Expo:** open https://expo.dev/accounts/mimifishman/projects/mage-card-game/builds
3. Click **Build from GitHub**.
4. Choose:
   - Git ref: `master`
   - Platform: **iOS**
   - Build profile: `preview`
5. Start the build. Wait about 15 minutes.
6. Install it on the iPhone (see "Install on the iPhone" below).

### Each time: make the dev app (development)

Only when the shell changed (see above). Otherwise skip this.

Do the same steps as the test app, but choose Build profile `development`.

### Install on the iPhone

1. On the Expo **Builds** page, click the new build.
2. Check that **Profile** says `preview` or `development`.
3. On the iPhone, open that page in **Safari** (scan the QR code).
4. Tap **Install**.
5. First time only: on the iPhone, go to
   **Settings → Privacy & Security → Developer Mode** and turn it on.

### Use the dev app

1. **Replit:** open the Mage project. Keep the tab open.
2. To get the newest code from GitHub: open the **Git** pane and click **Pull**.
3. In the **Workflows** tab, make sure these two run:
   - `artifacts/mobile: expo`
   - `artifacts/api-server: API Server`
4. **iPhone:** open **Mage Card Game Dev**. Enter this URL:
   `https://99f11984-d608-4ef4-b532-be1cd634f14f-00-2uu2xbdtqoihl.expo.riker.replit.dev`

The dev app shows the code that is on **Replit**, not the code on GitHub.

---

## If something goes wrong

- **Dev app says "Failed to connect"**: Replit went to sleep. Open the project
  on Replit and run the two workflows again.
- **"Install" does nothing, or the app will not open**: the iPhone is not on the
  list of allowed phones. See "Add another iPhone" in [IOS-BUILDS.md](IOS-BUILDS.md).
- **The Builds page shows only one app**: clear the filters, or pick "All" profiles.
- **"Build from GitHub" is missing**: do "Once only: connect Expo to GitHub" first.

---

## The other way: Terminal

Use this if the website way does not work.

1. Turn on Node 24 and check the Expo login (it must say `mimifishman`):

   ```bash
   eval "$(fnm env)"; fnm use 24
   ```

   ```bash
   npx eas-cli@latest whoami
   ```

2. Get clean code from `master` in its own folder:

   ```bash
   cd /Users/mimifishman/Work/AIApps/Mage-Card-Game
   git fetch origin
   git worktree add ../mage-build origin/master
   cd ../mage-build/artifacts/mobile
   ```

   If `../mage-build` already exists:

   ```bash
   cd /Users/mimifishman/Work/AIApps/mage-build
   git fetch origin
   git checkout --detach origin/master
   cd artifacts/mobile
   ```

3. Start the build. If it asks about an Apple login, answer **No**.

   ```bash
   npx eas-cli@latest build --platform ios --profile preview
   ```

   ```bash
   npx eas-cli@latest build --platform ios --profile development
   ```

For new iPhones, signing files and the yearly certificate renewal, see
[IOS-BUILDS.md](IOS-BUILDS.md).
