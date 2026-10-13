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

Android needs a signing key (the "stamp"). Expo makes it during the first
Android build of each app. This first build must start from the Terminal, so
Expo can ask "Generate a new Android Keystore?". Answer **Yes**. See "The other
way: Terminal" at the end, or ask Claude to do it. After that, use the website.

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

- **Easy way:** ask Claude "register a new iPhone". Claude gives you a link.
  The phone owner opens the link on the iPhone in **Safari** and follows the
  steps. The UDID then shows on Expo.
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

Ask Claude: "upload the new iPhone profiles to Expo". This step needs the
Terminal, so Claude does it.

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
  machine. `eas.json` names the machine (`image`). After an Expo SDK upgrade,
  ask Claude to update it.
- **Android: "App not installed"**: an older copy with a different signing key
  is on the phone. Delete the old app, then install again.
- **The Builds page shows only one app**: clear the filters, or pick "All".
- **"Build from GitHub" is missing**: do "Once only: connect Expo to GitHub" first.

---

## The other way: Terminal

Use this for the first Android build, or if the website way does not work.

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

3. Start the build. Pick the line you need.
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

For new iPhones, signing files and the yearly certificate renewal, see
[IOS-BUILDS.md](IOS-BUILDS.md).
