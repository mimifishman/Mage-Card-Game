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

### Once only: the first Android build of each app

**Already done (13 Oct 2026) for both apps.** You only need this again for a
new app with a new name.

Android needs a signing key (the "stamp"). Expo makes it during the first
Android build of each app. This first build must start from the Terminal, so
Expo can ask "Generate a new Android Keystore?". Answer **Yes**. See
"Terminal: make a build" at the end. After that, use the website.

iPhone does not need this. Its signing files are already on Expo.

### Each time: make the test app (preview)

1. **GitHub:** make sure the changes you want are on `master`. On
   https://github.com/mimifishman/Mage-Card-Game/pulls open the pull request and
   click **Merge pull request**.
2. **Expo:** open https://expo.dev/accounts/mimifishman/projects/mage-card-game/builds
3. Click **Build from GitHub**.
4. Choose:
   - Git ref: `master`
   - Platform: **iOS** or **Android**
   - Build profile: `preview`
5. Start the build. Wait about 15 minutes.
6. Do it again with the other platform, if you want both.
7. Install it (see "Install on the phone" below).

### Each time: make the dev app (development)

Only when the shell changed (see above). Otherwise skip this.

Do the same steps as the test app, but choose Build profile `development`.

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

- **With a link (the phone can be far away):** see "Terminal: get an iPhone's
  ID" at the end. You send the owner a link. They open it on the iPhone.
- **With a Mac and a cable:** plug the iPhone into the Mac. Open **Finder** and
  click the iPhone in the left side. Click the grey text under the phone name
  until it shows **UDID**. Right-click it and copy it.

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

### Step 4: give the new profiles to Expo

See "Terminal: upload new iPhone profiles to Expo" at the end.

### Step 5: make new builds and install

1. Make a new test app build (and dev app build, if they need it). See "Each
   time: make the test app" above. Choose Platform **iOS**.
2. Send the build page link to the phone owner. They install it as in
   "Install on the phone".

Apple allows up to 100 iPhones per year.

---

## If something goes wrong

- **Dev app says "Failed to connect"**: Replit went to sleep. Open the project
  on Replit and run the two workflows again.
- **iPhone: "Install" does nothing, or the app will not open**: the iPhone is
  not on Apple's list. See "Add a new iPhone" above.
- **Website build fails at "Install dependencies"**: Expo used an old build
  machine. `eas.json` names the machine (`image`). See "Terminal: change the
  build machine after an Expo upgrade" at the end.
- **Android: "App not installed"**: an older copy with a different signing key
  is on the phone. Delete the old app, then install again.
- **The Builds page shows only one app**: clear the filters, or pick "All".
- **"Build from GitHub" is missing**: do "Once only: connect Expo to GitHub" first.

---

## Terminal steps

You only need these for a few jobs. Each job starts with "Terminal: get
ready".

### Terminal: get ready

Do this first, every time.

1. Open the **Terminal** app on the Mac.
2. Turn on Node 24:

   ```bash
   eval "$(fnm env)"; fnm use 24
   ```

3. Check the Expo login. It must say `mimifishman`:

   ```bash
   npx eas-cli@latest whoami
   ```

   If it does not, log in:

   ```bash
   npx eas-cli@latest login
   ```

4. Get clean code from `master` in its own folder, called `mage-build`.

   **The first time** (makes the folder):

   ```bash
   cd /Users/mimifishman/Work/AIApps/Mage-Card-Game && git fetch origin && git worktree add ../mage-build origin/master
   ```

   **Every other time** (updates the folder):

   ```bash
   cd /Users/mimifishman/Work/AIApps/mage-build && git fetch origin && git checkout --detach origin/master
   ```

5. Install the packages and go to the app folder. This takes about 1 minute:

   ```bash
   cd /Users/mimifishman/Work/AIApps/mage-build && pnpm install --frozen-lockfile && cd artifacts/mobile
   ```

Never change files in `mage-build`. Expo uploads that folder as it is.

### Terminal: make a build

Use this for the first Android build of a new app, or when the website way
does not work. Do "Terminal: get ready" first, then pick the line you need.

- iPhone: if it asks about an Apple login, answer **No**.
- Android: if it asks "Generate a new Android Keystore?", answer **Yes**.

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

When it shows a link and "See logs", the build is on Expo. You can close the
Terminal.

### Terminal: get an iPhone's ID

Do "Terminal: get ready" first.

1. Run:

   ```bash
   npx eas-cli@latest device:create
   ```

2. Answer the questions:
   - "Log in to your Apple account?": **No**.
   - Apple Team ID: `LN6694N33Y`.
   - Team type, if it asks: **Individual**.
   - "How would you like to register your devices?": **Website**.
3. It shows a link and a QR code. Send the link to the phone owner.
4. The owner opens the link on the iPhone in **Safari**. They tap through and
   install the small profile it offers (Settings → **Profile Downloaded** →
   **Install**).
5. See the phone's ID:

   ```bash
   npx eas-cli@latest device:list
   ```

   The new phone shows with its **UDID**. Copy it for "Step 2: add the phone
   on Apple's website".

### Terminal: upload new iPhone profiles to Expo

Do "Terminal: get ready" first. You need the two profiles you downloaded in
"Step 3" (files that end in `.mobileprovision`, in your **Downloads** folder).

Do it once for the test app, then once for the dev app.

**A. Test app**

1. Run:

   ```bash
   npx eas-cli@latest credentials --platform ios
   ```

2. Build profile: **preview**. Log in to Apple: **No**.
3. Choose **credentials.json** → **Download credentials from EAS to
   credentials.json**. This makes a file `credentials.json` and a folder
   `credentials/ios/`.
4. Open `credentials/ios/` in Finder:

   ```bash
   open credentials/ios
   ```

5. It has one file that ends in `.mobileprovision`. Note its name. Delete it.
   Put the new **Mage Card Game Ad Hoc** profile from Downloads there. Rename
   it to the old name.
6. Run the same command again. Build profile **preview**, Apple login **No**.
   Choose **credentials.json** → **Upload credentials from credentials.json
   to EAS**. If it asks the type of distribution, choose **Ad Hoc**. Answer
   **Yes** to the questions.
7. Check that the output says **Bundle Identifier: com.magecardgame**.
8. Delete the files. They hold the private signing key:

   ```bash
   rm -rf credentials.json credentials
   ```

**B. Dev app**

Same steps, with two changes:

- Start the command with `APP_VARIANT=development` in front, both times:

  ```bash
  APP_VARIANT=development npx eas-cli@latest credentials --platform ios
  ```

- Choose build profile **development**, and use the **Mage Card Game Dev Ad
  Hoc** profile.

Check that the output says **Bundle Identifier: com.magecardgame.dev**. If it
says `com.magecardgame` (no `.dev`), you forgot `APP_VARIANT=development`.
Then do part A again at once, to repair the test app.

Delete the files at the end:

```bash
rm -rf credentials.json credentials
```

### Terminal: change the build machine after an Expo upgrade

Only when the Expo SDK version changes (for example 54 to 55).

1. Open https://docs.expo.dev/build-reference/infrastructure/
2. Find the iOS image marked `sdk-55` (your new version). Copy its full name,
   for example `macos-...-xcode-...`. Do the same for Android.
3. On GitHub, open `artifacts/mobile/eas.json` and click the pencil (Edit).
4. Under `"base"`, put the new names in `"ios": { "image": ... }` and
   `"android": { "image": ... }`.
5. Choose **Create a new branch and start a pull request**. Then merge it.

For the yearly certificate renewal (before 11 Oct 2027), see
[IOS-BUILDS.md](IOS-BUILDS.md).
