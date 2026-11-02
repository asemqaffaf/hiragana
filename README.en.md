**Read this in:** [日本語](README.md) · **English** · [العربية](README.ar.md)

# ひらがな — Hiragana in 14 days

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

## Optional cloud sync

The app works locally without cloud setup. For progress across devices, the included [Google Apps Script](scripts/google-apps-script.gs) acts as the backend and stores student records in a private Google Drive JSON file. No separately hosted server or database service is required.

1. Create a `students.json` file containing `{}` in Google Drive and keep access **Restricted**.
2. Create an Apps Script project, copy in [`scripts/google-apps-script.gs`](scripts/google-apps-script.gs), and replace `FILE_ID` with your file's ID.
3. In **Project Settings → Script Properties**, set `TEACHER_KEY` to a long random password.
4. Deploy as a **Web app**, with **Execute as: Me** and **Who has access: Anyone**, then copy the `/exec` URL.
5. In your GitHub repository, add that URL under **Settings → Secrets and variables → Actions** as the `SYNC_URL` repository secret. Set **Settings → Pages → Source** to **GitHub Actions**.
6. Push to `main` or run the [Pages workflow](.github/workflows/pages.yml) manually. The workflow inserts the sync URL into the published site; without the secret, it publishes with sync disabled.

For local sync testing, set `SYNC_URL` in [`js/core/cloud-config.js`](js/core/cloud-config.js) to your web app URL and keep that change out of commits. After updating the Apps Script code, deploy a new version.

Changes save locally first and queue for sync when online. Apps Script uses `LockService` to serialise writes and checks record versions to detect conflicting saves. Passwords derive a credential in the browser using PBKDF2-SHA-256 (310,000 iterations); Drive stores a SHA-256 hash of that credential, never the original password. The published client receives the sync endpoint; `TEACHER_KEY` belongs only in Apps Script properties.

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
