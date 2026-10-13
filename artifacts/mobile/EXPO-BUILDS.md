# Make the phone apps (simple guide)

This works for **iPhone** and for **Android** (Google) phones. The steps are
the same. Where they are different, it says so.

## What is going on

There are two apps. Both can be on one phone.

| | **Mage Card Game** (test app) | **Mage Card Game Dev** (dev app) |
|---|---|---|
| Expo profile | `preview` | `development` |
| Think of it as | a **printed book** | a **TV** |
| Game code | printed inside the app | sent live from Replit |
| Server and database | live | dev |
| You change the code | make a new build | nothing, it updates by itself |
| Needs Replit open | no | yes |

You make each app once for iPhone and once for Android. So there are four
builds in total: test app iPhone, test app Android, dev app iPhone, dev app
Android.

### The test app is a printed book

When Expo makes the test app, it:

1. Takes all the game code.
2. Adds the live settings: the live server and the live sign-in.
3. Packs it all into one app. It adds a "stamp" (a signature), so the phone
   trusts it.

The result is a finished app. It works alone. To change the game, you print a
new book: you make a new build (about 15 minutes).

### The dev app is a TV

When Expo makes the dev app, it packs only the **shell**. The shell is the part
that talks to the phone: screen, sign-in, sound. It adds a small **loader**,
not the game.

When you open the dev app, the loader gets the game code from Replit. So:

- Change the code on Replit, and the app shows the change at once.
- If Replit is asleep, the app has nothing to show ("Failed to connect").
- You make a new dev build only when the shell changes: a new package that
  talks to the phone, a change to `app.json`, or a new Expo version. This
  happens seldom.

### iPhone and Android: what is different

| | iPhone | Android |
|---|---|---|
| Who can install | only phones on Apple's list | any phone with the link |
| Add a new phone | yes, see "Add a new iPhone" below | no, just send the link |
| First-time phone setting | turn on Developer Mode | allow installs from the browser |

---

## Make and install the apps

Most of the time you use only three websites: **GitHub**, **Expo** and
**Replit**. A few jobs need the Terminal. Their steps are written right where
you need them.

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

### Once only: the first Android build of each app

**Already done (13 Oct 2026) for both apps.** You only need this again for a
new app with a new name.

Android needs a signing key (the "stamp"). Expo makes it during the first
Android build of each app. This first build must start from the Terminal, so
Expo can ask you "Generate a new Android Keystore?".

1. Get the Terminal ready:

   1. Open the **Terminal** app on the Mac.
   2. Turn on Node 24:

      ```bash
      eval "$(fnm env)"; fnm use 24
      ```

   3. Check the Expo login. It must say `mimifishman`. If not, run
      `npx eas-cli@latest login`.

      ```bash
      npx eas-cli@latest whoami
      ```

   4. Get clean code from `master` in its own folder, `mage-build`.
      **First time ever** (makes the folder):

      ```bash
      cd /Users/mimifishman/Work/AIApps/Mage-Card-Game && git fetch origin && git worktree add ../mage-build origin/master
      ```

      **Every other time** (updates the folder):

      ```bash
      cd /Users/mimifishman/Work/AIApps/mage-build && git fetch origin && git checkout --detach origin/master
      ```

   5. Install the packages and go to the app folder (about 1 minute):

      ```bash
      cd /Users/mimifishman/Work/AIApps/mage-build && pnpm install --frozen-lockfile && cd artifacts/mobile
      ```

   Never change files in `mage-build`. Expo uploads that folder as it is.

2. Start the build. Pick the line for the app:

   ```bash
   npx eas-cli@latest build --platform android --profile preview
   ```

   ```bash
   npx eas-cli@latest build --platform android --profile development
   ```

3. When it asks "Generate a new Android Keystore?", press **Y**, then **Enter**.
4. When it shows a link and "See logs", the build is on Expo. You can close
   the Terminal. From now on, use the website.

iPhone does not need this. Its signing files are already on Expo.

### Each time: make the test app (preview)

1. **GitHub:** make sure the changes you want are on `master`. On
   https://github.com/mimifishman/Mage-Card-Game/pulls open the pull request and
   click **Merge pull request**.
2. **Expo:** open https://expo.dev/accounts/mimifishman/projects/mage-card-game/builds
3. Click **Build from GitHub**.
4. Choose:
   - Base directory: `artifacts/mobile`
   - Platform: **iOS** or **Android**
   - Git ref: `master`
   - EAS Build profile: type `preview` (the grey "production" is only a
     sample; never leave it empty)
   - Environment: **Default**
5. Click **Confirm**. Wait about 15 minutes.
6. Do it again with the other platform, if you want both.
7. Install it (see "Install on the phone" just below).

### Each time: make the dev app (development)

Only when the shell changed (see "The dev app is a TV"). Otherwise skip this.

Do the same steps as the test app, but type `development` as the EAS Build
profile.

### If the website build does not work: use the Terminal

1. Get the Terminal ready:

   1. Open the **Terminal** app on the Mac.
   2. Turn on Node 24:

      ```bash
      eval "$(fnm env)"; fnm use 24
      ```

   3. Check the Expo login. It must say `mimifishman`. If not, run
      `npx eas-cli@latest login`.

      ```bash
      npx eas-cli@latest whoami
      ```

   4. Get clean code from `master` in its own folder, `mage-build`.
      **First time ever** (makes the folder):

      ```bash
      cd /Users/mimifishman/Work/AIApps/Mage-Card-Game && git fetch origin && git worktree add ../mage-build origin/master
      ```

      **Every other time** (updates the folder):

      ```bash
      cd /Users/mimifishman/Work/AIApps/mage-build && git fetch origin && git checkout --detach origin/master
      ```

   5. Install the packages and go to the app folder (about 1 minute):

      ```bash
      cd /Users/mimifishman/Work/AIApps/mage-build && pnpm install --frozen-lockfile && cd artifacts/mobile
      ```

   Never change files in `mage-build`. Expo uploads that folder as it is.

2. Start the build. Pick the line you need:

   ```bash
   npx eas-cli@latest build --platform ios --profile preview
   ```

   ```bash
   npx eas-cli@latest build --platform ios --profile development
   ```

   ```bash
   npx eas-cli@latest build --platform android --profile preview
   ```

   ```bash
   npx eas-cli@latest build --platform android --profile development
   ```

3. If it asks about an Apple login, answer **No**.
4. When it shows a link and "See logs", the build is on Expo. You can close
   the Terminal.

### Install on the phone

1. On the Expo **Builds** page, click the new build.
2. Check that **Profile** (`preview` or `development`) and **Platform** are
   correct.
3. Open that page on the phone (scan the QR code).

**iPhone:**

4. Open the page in **Safari**. Tap **Install**.
5. First time only: go to **Settings → Privacy & Security → Developer Mode**
   and turn it on.

**Android:**

4. Tap **Install**. The phone downloads the app file (an APK).
5. Open the file. If the phone asks, allow installs from the browser
   (**Install unknown apps**).
6. The phone may warn that the app is not from the Play Store. Tap
   **Install anyway**. This is normal for test apps.

### Use the dev app

1. **Replit:** open the Mage project. Keep the tab open.
2. To get the newest code from GitHub: open the **Git** pane and click **Pull**.
3. In the **Workflows** tab, make sure these two run:
   - `artifacts/mobile: expo`
   - `artifacts/api-server: API Server`
4. **Phone:** open **Mage Card Game Dev**. Enter this URL:
   `https://99f11984-d608-4ef4-b532-be1cd634f14f-00-2uu2xbdtqoihl.expo.riker.replit.dev`

The dev app shows the code that is on **Replit**, not the code on GitHub.

---

## Add a new iPhone

An iPhone app from Expo opens only on iPhones that are on Apple's list.
To add a phone, you put it on the list, then make a new build. Old builds do
not open on the new phone.

Android phones do not need this. Just send them the link.

### Step 1: get the phone's ID

Every iPhone has an ID called a **UDID** (a long code of letters and numbers).
Pick one way.

**Way A: with a Mac and a cable** (the phone is with you)

1. Plug the iPhone into the Mac.
2. Open **Finder**. Click the iPhone in the left side.
3. Click the grey text under the phone name until it shows **UDID**.
4. Right-click it and copy it.

**Way B: with a link** (the phone can be far away)

1. Get the Terminal ready:

   1. Open the **Terminal** app on the Mac.
   2. Turn on Node 24:

      ```bash
      eval "$(fnm env)"; fnm use 24
      ```

   3. Check the Expo login. It must say `mimifishman`. If not, run
      `npx eas-cli@latest login`.

      ```bash
      npx eas-cli@latest whoami
      ```

   4. Get clean code from `master` in its own folder, `mage-build`.
      **First time ever** (makes the folder):

      ```bash
      cd /Users/mimifishman/Work/AIApps/Mage-Card-Game && git fetch origin && git worktree add ../mage-build origin/master
      ```

      **Every other time** (updates the folder):

      ```bash
      cd /Users/mimifishman/Work/AIApps/mage-build && git fetch origin && git checkout --detach origin/master
      ```

   5. Install the packages and go to the app folder (about 1 minute):

      ```bash
      cd /Users/mimifishman/Work/AIApps/mage-build && pnpm install --frozen-lockfile && cd artifacts/mobile
      ```

   Never change files in `mage-build`. Expo uploads that folder as it is.

2. Run:

   ```bash
   npx eas-cli@latest device:create
   ```

3. Answer the questions:
   - "Log in to your Apple account?": **No**.
   - Apple Team ID: `LN6694N33Y`.
   - Team type, if it asks: **Individual**.
   - "How would you like to register your devices?": **Website**.
4. It shows a link and a QR code. Send the link to the phone owner.
5. The owner opens the link on the iPhone in **Safari**. They install the small
   profile it offers (Settings → **Profile Downloaded** → **Install**).
6. See the phone's ID:

   ```bash
   npx eas-cli@latest device:list
   ```

   The new phone shows with its **UDID**. Copy it.

### Step 2: add the phone on Apple's website

Use the Chrome window where Jason's Apple account is signed in.

1. Open https://developer.apple.com/account/resources/devices/list
2. Click the blue **+**.
3. Platform: **iOS**. Device Name: the owner's name, for example "Dana iPhone".
   Device ID: paste the UDID.
4. Click **Continue**, then **Register**.

### Step 3: put the phone in both app profiles

A profile is Apple's list of phones that may open one app. There is one per
app.

1. Open https://developer.apple.com/account/resources/profiles/list
2. Click **Mage Card Game Ad Hoc** → **Edit**.
3. Tick the new phone. Click **Save**. Click **Download**.
4. Do the same for **Mage Card Game Dev Ad Hoc**.

The two files go to your **Downloads** folder. They end in `.mobileprovision`.

### Step 4: give the new profiles to Expo

1. Get the Terminal ready:

   1. Open the **Terminal** app on the Mac.
   2. Turn on Node 24:

      ```bash
      eval "$(fnm env)"; fnm use 24
      ```

   3. Check the Expo login. It must say `mimifishman`. If not, run
      `npx eas-cli@latest login`.

      ```bash
      npx eas-cli@latest whoami
      ```

   4. Get clean code from `master` in its own folder, `mage-build`.
      **First time ever** (makes the folder):

      ```bash
      cd /Users/mimifishman/Work/AIApps/Mage-Card-Game && git fetch origin && git worktree add ../mage-build origin/master
      ```

      **Every other time** (updates the folder):

      ```bash
      cd /Users/mimifishman/Work/AIApps/mage-build && git fetch origin && git checkout --detach origin/master
      ```

   5. Install the packages and go to the app folder (about 1 minute):

      ```bash
      cd /Users/mimifishman/Work/AIApps/mage-build && pnpm install --frozen-lockfile && cd artifacts/mobile
      ```

   Never change files in `mage-build`. Expo uploads that folder as it is.

**A. Test app**

2. Run:

   ```bash
   npx eas-cli@latest credentials --platform ios
   ```

3. Build profile: **preview**. Log in to Apple: **No**.
4. Choose **credentials.json** → **Download credentials from EAS to
   credentials.json**. This makes a file `credentials.json` and a folder
   `credentials/ios/`.
5. Open the folder in Finder:

   ```bash
   open credentials/ios
   ```

6. It has one file that ends in `.mobileprovision`. Note its name. Delete it.
   Put the new **Mage Card Game Ad Hoc** file from Downloads there. Rename it
   to the old name.
7. Run the same command again:

   ```bash
   npx eas-cli@latest credentials --platform ios
   ```

   Build profile **preview**, Apple login **No**. Choose **credentials.json** →
   **Upload credentials from credentials.json to EAS**. If it asks the type of
   distribution, choose **Ad Hoc**. Answer **Yes** to the questions.
8. Check that the output says **Bundle Identifier: com.magecardgame**.
9. Delete the files. They hold the private signing key:

   ```bash
   rm -rf credentials.json credentials
   ```

**B. Dev app**

10. Run (note `APP_VARIANT=development` at the start):

    ```bash
    APP_VARIANT=development npx eas-cli@latest credentials --platform ios
    ```

11. Build profile: **development**. Log in to Apple: **No**. Choose
    **credentials.json** → **Download credentials from EAS to
    credentials.json**.
12. Open the folder:

    ```bash
    open credentials/ios
    ```

    Swap the `.mobileprovision` file as in step 6, but use the **Mage Card Game
    Dev Ad Hoc** file.
13. Run the same command again:

    ```bash
    APP_VARIANT=development npx eas-cli@latest credentials --platform ios
    ```

    Build profile **development**, Apple login **No**. Choose
    **credentials.json** → **Upload credentials from credentials.json to EAS**
    → **Ad Hoc**. Answer **Yes** to the questions.
14. Check that the output says **Bundle Identifier: com.magecardgame.dev**.
    If it says `com.magecardgame` (no `.dev`), you forgot
    `APP_VARIANT=development`. Then do part A again at once, to repair the
    test app.
15. Delete the files:

    ```bash
    rm -rf credentials.json credentials
    ```

### Step 5: make new builds and install

1. Open https://expo.dev/accounts/mimifishman/projects/mage-card-game/builds
2. Click **Build from GitHub**. Choose Base directory `artifacts/mobile`,
   Platform **iOS**, Git ref `master`, EAS Build profile `preview`,
   Environment **Default**. Click **Confirm**.
3. If the new phone also needs the dev app, do it again with profile
   `development`.
4. When the build finishes, send the build page link to the phone owner.
5. The owner opens it on the iPhone in **Safari** and taps **Install**. First
   time only: **Settings → Privacy & Security → Developer Mode** → on.

Apple allows up to 100 iPhones per year.

---

## If something goes wrong

- **Dev app says "Failed to connect"**: Replit went to sleep. Open the project
  on Replit and run the two workflows again.
- **iPhone: "Install" does nothing, or the app will not open**: the iPhone is
  not on Apple's list. Do "Add a new iPhone".
- **Android: "App not installed"**: an older copy with a different signing key
  is on the phone. Delete the old app, then install again.
- **The Builds page shows only one app**: clear the filters, or pick "All".
- **"Build from GitHub" is missing**: do "Once only: connect Expo to GitHub".
- **Website build fails at "Install dependencies"**: Expo used an old build
  machine. This happens after an Expo SDK upgrade (for example 54 to 55).
  `eas.json` names the machine. To change it:
  1. Open https://docs.expo.dev/build-reference/infrastructure/
  2. Find the iOS image marked `sdk-55` (your new version). Copy its full
     name, for example `macos-...-xcode-...`. Do the same for Android.
  3. On GitHub, open `artifacts/mobile/eas.json` and click the pencil (Edit).
  4. Under `"base"`, put the new names in `"ios": { "image": ... }` and
     `"android": { "image": ... }`.
  5. Choose **Create a new branch and start a pull request**. Then merge it.

For the yearly certificate renewal (before 11 Oct 2027), see
[IOS-BUILDS.md](IOS-BUILDS.md).
