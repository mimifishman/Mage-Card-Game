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

## The Apple key (no Apple login needed)

To add an iPhone or make a new certificate, Expo must talk to Apple.
Before, this needed Jason's Apple login. Now Expo uses a **key** instead.
The key is a small secret file.

- Name on Apple: **Expo Admin**. Access: **Admin**. You find it on
  App Store Connect → **Users and Access** → **Integrations** → **Team Keys**.
- Key ID: `5B6UHLK7V9`
- Issuer ID: `3f026ab2-defe-4d4a-b2ad-8383ce691847`
- Apple team: `LN6694N33Y` (Jason Kipp, Individual)
- The file: `~/.appstoreconnect/private_keys/AuthKey_5B6UHLK7V9.p8` on
  Mimi's Mac. A copy is in Mimi's password manager.

Rules:

- The file is a secret. Never put it on GitHub, in a chat or in an email.
- Never put it in a project folder.
- The other key, **Expo** (`VV4G7U8U8C`, App Manager), stays on Expo. Expo
  uses it to send builds to the App Store. It cannot add iPhones. Leave it.

**Turn on the key.** Run this in the Terminal, before the Expo commands:

```bash
export EXPO_ASC_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_5B6UHLK7V9.p8" EXPO_ASC_KEY_ID=5B6UHLK7V9 EXPO_ASC_ISSUER_ID=3f026ab2-defe-4d4a-b2ad-8383ce691847 EXPO_APPLE_TEAM_ID=LN6694N33Y EXPO_APPLE_TEAM_TYPE=INDIVIDUAL
```

The key stays on until you close that Terminal window. While it is on,
Expo does not ask "Log in to your Apple account?". It uses the key.

**Check that the file is there:**

```bash
ls -l ~/.appstoreconnect/private_keys/
```

It must show `AuthKey_5B6UHLK7V9.p8` and `-rw-------` (only you can read it).

**New Mac, or the file is gone:**

1. Get the file from the password manager.
2. Save it as `~/.appstoreconnect/private_keys/AuthKey_5B6UHLK7V9.p8`.
3. Lock it:

   ```bash
   chmod 700 ~/.appstoreconnect ~/.appstoreconnect/private_keys && chmod 600 ~/.appstoreconnect/private_keys/AuthKey_5B6UHLK7V9.p8
   ```

**The file is lost, or someone else saw it:**

1. App Store Connect → **Integrations** → **Team Keys**. Click **Revoke**
   next to **Expo Admin**. (Revoke means Apple turns the key off.)
2. Make a new key: **+**, name `Expo Admin`, Access **Admin**, **Generate**,
   **Download**. Apple lets you download it only one time.
3. Put it in the Mac folder and in the password manager, as above.
4. In this guide and in [IOS-BUILDS.md](IOS-BUILDS.md), change the Key ID
   and the file name.

---

## Get the Terminal ready (with the Apple key)

"Add a new iPhone" and "Yearly renewal" start with these steps.

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

6. Turn on the Apple key:

   ```bash
   export EXPO_ASC_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_5B6UHLK7V9.p8" EXPO_ASC_KEY_ID=5B6UHLK7V9 EXPO_ASC_ISSUER_ID=3f026ab2-defe-4d4a-b2ad-8383ce691847 EXPO_APPLE_TEAM_ID=LN6694N33Y EXPO_APPLE_TEAM_TYPE=INDIVIDUAL
   ```

Never change files in `mage-build`. Expo uploads that folder as it is.

---

## Add a new iPhone

An iPhone app from Expo opens only on iPhones that are on Apple's list.
To add a phone:

1. You put it on **Expo's** list.
2. You make a new build with one special command. Expo then puts the phone
   on **Apple's** list for you.

Old builds do not open on the new phone. Nobody needs Jason's Apple login.

Android phones do not need this. Just send them the link.

### Step 1: get the Terminal ready

Do "Get the Terminal ready (with the Apple key)" above. Do not forget step 6.

### Step 2: put the phone on Expo's list

1. Run:

   ```bash
   npx eas-cli@latest device:create
   ```

2. "Would you like to use the mimifishman account?": **Yes**.
3. "How would you like to register your devices?": pick one way.

   **Website** (the phone can be far away):

   1. It shows a link and a QR code. Send the link to the phone owner.
   2. The owner opens the link on the iPhone in **Safari**.
   3. The owner installs the small profile it offers: Settings →
      **Profile Downloaded** → **Install**.
   4. In the Terminal, press any key.

   **Input** (you have the phone's ID already):

   Every iPhone has an ID called a **UDID** (a long code). To see it:
   plug the iPhone into the Mac, open **Finder**, click the iPhone, and
   click the grey text under the phone name until it shows **UDID**.
   Right-click it and copy it. Then type a name (for example "Dana iPhone")
   and paste the UDID.

4. Check that the phone is on Expo's list:

   ```bash
   npx eas-cli@latest device:list
   ```

### Step 3: make the new builds

Test app:

```bash
npx eas-cli@latest build --platform ios --profile preview --non-interactive --refresh-ad-hoc-provisioning-profile
```

Dev app (only if the new phone needs it too):

```bash
npx eas-cli@latest build --platform ios --profile development --non-interactive --refresh-ad-hoc-provisioning-profile
```

Each command does 4 jobs and asks no questions:

1. It puts every phone from Expo's list on Apple's list.
2. It updates the app's profile on Apple, with all the phones. (A profile is
   Apple's list of phones that may open one app.)
3. It saves the new profile on Expo.
4. It starts the build.

When it shows a link, the build is on Expo. You can close the Terminal.
Wait about 15 minutes.

If it says **"Failed to provision ... of the selected devices"**: Apple is
still checking the new phone. This can take up to 72 hours. Do Step 3 again
later.

From now on, website builds (**Build from GitHub**) include the new phone
too.

### Step 4: install

1. Open https://expo.dev/accounts/mimifishman/projects/mage-card-game/builds
2. When the build finishes, send the build page link to the phone owner.
3. The owner opens it on the iPhone in **Safari** and taps **Install**.
4. First time only: **Settings → Privacy & Security → Developer Mode** → on.

Apple allows up to 100 iPhones per year.

---

## Yearly renewal (before 11 Oct 2027)

The certificate is the "stamp" that makes the iPhone trust the app. It lasts
one year. Apple does not make longer ones. When it ends, the **test app**
and the **dev app** stop opening. The App Store app keeps working.

Do this about one month before **11 Oct 2027**. You do not need Jason.

These steps come from Expo's code (eas-cli 25.3). Nobody has run them yet,
because they make a real certificate. Read each question before you answer.

1. Do "Get the Terminal ready (with the Apple key)" above.
2. **Test app: make the new certificate.**

   ```bash
   npx eas-cli@latest credentials --platform ios
   ```

   1. Build profile: **preview**.
   2. Choose **Build Credentials: Manage everything needed to build your
      project**.
   3. Choose **Distribution Certificate: Add a new one to your account**.
      Expo makes the certificate at Apple and keeps it.
   4. If it asks **"Select certificates to revoke"**: do not tick any.
      Press **Ctrl+C** and stop. Ask first. (Revoke means Apple deletes the
      certificate. Apps signed with it stop opening at once.)
   5. "Do you want ... to use the new Distribution Certificate?": **Yes**.
      Expo makes a new profile for the test app.
   6. Choose **Go back**, then **Exit**.

3. **Dev app: use the same new certificate.** Note `APP_VARIANT=development`
   at the start:

   ```bash
   APP_VARIANT=development npx eas-cli@latest credentials --platform ios
   ```

   1. Build profile: **development**.
   2. **Build Credentials: Manage everything needed to build your project**.
   3. **Distribution Certificate: Use an existing one for your project**.
   4. Pick the certificate with the latest end date (in 2028).
   5. Check that the output says `com.magecardgame.dev`.
   6. **Go back**, then **Exit**.

4. **App Store app: use the same new certificate.**

   ```bash
   npx eas-cli@latest credentials --platform ios
   ```

   Build profile **production**. Then do 2–4 and 6 from the dev app step.

5. Make new builds of the test app and the dev app (**Build from GitHub** is
   fine). Install them on every phone again.
6. In this guide and in [IOS-BUILDS.md](IOS-BUILDS.md), change
   "11 Oct 2027" to the new end date.

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
- **"not associated with Apple Team ID LN6694N33Y"** or an Apple login
  question: the Apple key is not on. Do step 6 of "Get the Terminal ready
  (with the Apple key)" in this Terminal window.
- **"The App Store Connect API key in use has no Issuer ID"**: the
  `EXPO_ASC_ISSUER_ID` part is missing. Run the whole key line again.
