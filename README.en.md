**Read this in:** [日本語](README.md) · **English** · [العربية](README.ar.md)

# ひらがな — Hiragana in 14 days

**No server to manage. No database to set up. Full-stack app experience.**

A complete browser-based learning app with profiles, password sign-in, progress storage, and optional cloud sync. The default app runs entirely in the browser using `localStorage`. Optional sync uses Google Apps Script as a managed backend and private JSON files in Google Drive, so there is no separate server to manage or database service to provision.

Learn to read, write, and recognise 104 hiragana characters and combinations: 46 basic characters, 25 voiced and semi-voiced forms, and 33 yōon combinations. Study with guided lessons, stroke-order practice, listening drills, and reading exercises with Japanese audio.

[**Start learning →**](https://asemqaffaf.github.io/hiragana/) · [Add a language](docs/languages.md)

Created by Asem Qaffaf. Built with plain HTML, CSS, and JavaScript modules, with no framework, build step, or runtime package dependencies.

## What you can do

- **Follow a study plan:** Choose a 7-, 14-, or 21-day pace and adjust your daily study time.
- **Practise writing:** Watch stroke order and draw on a touch-friendly canvas.
- **Train recognition and listening:** Read kana, choose answers, and practise with Japanese audio.
- **Read in context:** Explore vocabulary, phrases, and example sentences with translations.
- **Track your progress:** Use student profiles, review weak characters, and export or import your data.
- **Make it yours:** Choose from seven colour themes, light/dark/system appearance, and Child Mode. The interface uses translucent glass surfaces and a floating tab bar.

## Languages

Documentation and the app interface have separate language support:

| Language | README | App interface |
| --- | --- | --- |
| 日本語 | [日本語](README.md) | Not currently included |
| English | This page | Included (left to right) |
| العربية | [العربية](README.ar.md) | Included (right to left) |

Choose a language on the first screen or change it in your profile. Before sign-in, the app uses the saved device language or a supported browser preference, falling back to English. Each student profile remembers its own language.

New locales are registered in [`js/i18n/locales.js`](js/i18n/locales.js). The app uses their metadata for language selectors, text direction, and date formatting. Missing interface strings and learning content fall back to English, so translations can be added gradually.

### Add a translation

From the repository root, scaffold a locale using its language tag and native name:

```sh
python3 scripts/add_language.py fr Français
```

This creates `js/i18n/fr.js`, registers it, and makes it available in the language selectors. Translate its `strings` and `content` fields, preserving placeholders such as `{name}` and `{n}`. For a right-to-left language, add `--direction rtl` to the scaffold command.

```sh
node scripts/check-locales.mjs fr
node scripts/check-locales.mjs fr --strict
```

The default audit permits missing translations; `--strict` also fails on missing interface strings. Both modes reject unknown keys, incorrect value types, and placeholder mismatches. These checks cover interface strings; review learning-content translations separately.

See the [translation guide](docs/languages.md) for content dictionaries, plural forms, regional language tags, and browser checks. When changing shared documentation, keep all three READMEs aligned and update their language links if you add another version.

## Run locally

Clone the repository, enter its directory, and serve it over HTTP:

```sh
git clone https://github.com/asemqaffaf/hiragana.git
cd hiragana
python3 -m http.server 8000
```

Open [http://localhost:8000/](http://localhost:8000/). Python 3 is enough to serve the app; Node.js is only needed for development checks. Use a local server because the app loads JavaScript modules.

Progress is saved in the browser's `localStorage`. Cloud sync is disabled by default in a local checkout. Export your profile before clearing browser data or moving to another browser if you are not using sync.

## Remember your sign-in

Select **Remember me on this device for 30 days** when creating a profile, signing in, or importing a profile to reopen the app without entering your password again. It is off by default; use it only on a trusted device. Reloading or reopening the browser does not extend the 30-day expiry. Without this option, the app asks for your password again after a reload or browser restart.

Choose **Switch student** in your profile to sign out and clear the remembered login. Deleting the profile, changing its password on this device, clearing browser storage, or reaching the expiry also ends it. Remembered sign-in is unavailable when browser storage is blocked; private browsing may discard it when the private session ends.

This is a device-local convenience, not a server-issued JWT or refresh-token session. It uses a local expiry record tied to the profile's password verifier; the app already stores a password-derived bearer credential in `localStorage` for cloud sync. Anyone with access to the browser profile or scripts running on the same origin can access local data and credentials. Cloud authorization still checks the credential on every request; password changes on another device do not immediately lock local data here. Server-enforced sessions with protected cookies, refresh-token rotation, and remote revocation require a backend designed for those features.

## Optional cloud sync

The app works locally without cloud setup. For progress across devices, the included [Google Apps Script](scripts/google-apps-script.gs) acts as the backend and stores student records in a private Google Drive JSON file. No separately hosted server or database service is required.

1. Create a `students.json` file containing `{}` in Google Drive and keep access **Restricted**.
2. Create an Apps Script project, copy in [`scripts/google-apps-script.gs`](scripts/google-apps-script.gs), and replace `FILE_ID` with your file's ID.
3. In **Project Settings → Script Properties**, set `TEACHER_KEY` to a long random password.
4. Deploy as a **Web app**, with **Execute as: Me** and **Who has access: Anyone**, then copy the `/exec` URL.
5. In your GitHub repository, add that URL under **Settings → Secrets and variables → Actions** as the `SYNC_URL` repository secret. Set **Settings → Pages → Source** to **GitHub Actions**.
6. Push to `main` or run the [Pages workflow](.github/workflows/pages.yml) manually. The workflow inserts the sync URL into the published site; without the secret, it publishes with sync disabled.

For local sync testing, set `SYNC_URL` in [`js/core/cloud-config.js`](js/core/cloud-config.js) to your web app URL and keep that change out of commits. After updating the Apps Script code, deploy a new version.

Changes save locally first and queue for sync when online. Each device sends its changes automatically; to bring in changes made on another device, open your profile and tap **Sync now** (there is no background polling, which keeps the shared Apps Script quota free). Progress from two devices is merged (larger counts, earlier dates, every letter and lesson either device completed), so neither device overwrites the other; if both devices edited the profile details, the device that is sending keeps its own edit. Resetting progress is not merged with older progress, so a reset stays in place on other devices.

**Guest mode.** **Continue as guest** on the sign-in screen opens a local-only profile with no account or password. A guest is never sent to the cloud and stays signed in until you choose **Switch student**. When creating a profile later, tick **Bring my guest progress** to keep what the guest learned. Apps Script uses `LockService` to serialise writes and checks record versions to detect conflicting saves. Passwords derive a credential in the browser using PBKDF2-SHA-256 (310,000 iterations); Drive stores a SHA-256 hash of that credential, never the original password. The published client receives the sync endpoint; `TEACHER_KEY` belongs only in Apps Script properties.

To protect against Google quota exhaustion and lock contention, Apps Script rate-limits requests in memory via `CacheService` and rejects locked IDs before taking locks or touching Google Drive. Student records, quota metrics, and manual backups can be retrieved using `node scripts/export-students.mjs <SYNC_URL> --key <TEACHER_KEY>` (`GET ?key=...` is disabled so credentials never appear in URLs). Automatic versioned backups rotate in Google Drive. For Google account isolation, incident runbooks, and a Firebase/Firestore scalability evaluation, see [`docs/cloud-security.md`](docs/cloud-security.md).

## Development checks

Install the development tools and run the core checks:

```sh
npm install
npm run typecheck
npm run test:core
node scripts/check-locales.mjs --strict
```

For the browser language checks, install Playwright in a virtual environment:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/requirements.txt
.venv/bin/python -m playwright install chromium
PYTHON=.venv/bin/python tests/run_all.sh localetest --jobs 1
```

The runner starts its own local server. Omit `localetest` to run all browser suites. See [`docs/languages.md`](docs/languages.md) for WebKit verification.

## Credits

- Stroke data: [KanjiVG](https://kanjivg.tagaini.net) ([CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)).
- Japanese voice: VOICEVOX:No.7 ([VOICEVOX](https://voicevox.hiroshiba.jp/)).
- Fonts: Klee One, Zen Kaku Gothic New, and IBM Plex Sans Arabic (Google Fonts).
