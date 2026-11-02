# Hiragana in 14 days

A study kit for all 104 hiragana, in English and Arabic: a 14-day plan, a chart with memory hooks and animated stroke order, drills (read, choose, listen), handwriting practice that checks every stroke, and JLPT N5-level reading practice with recorded audio.

Created by Asem Qaffaf.

Live: https://asemqaffaf.github.io/hiragana/

## How to use it

- A Back button is on every page except Today and stays at the top while you scroll. The browser or phone back gesture works too.
- Four tabs at the bottom: **Today**, **Letters**, **Practice** (Quiz, Write, Words, Phrases) and **Progress**. The profile opens from the icon at the top.
- **Today** runs a guided lesson, one step at a time: meet the new letters, write them, learn today's words, then a quick quiz. Reaching 90% in the quiz finishes the day.

## Daily words and phrases

- 168 everyday words, 12 per plan day, each with an example sentence in hiragana, romaji, English and Arabic. Hear plays the word twice, then the sentence. Words on days 1 to 7 use only letters already learned.
- Every basic letter also has 3 example words (one played by Hear, two more with their own Hear buttons).
- 117 useful phrases in 13 groups: greetings, polite basics, meeting people, when you do not understand, shopping, food and halal, getting around, help and health, work and home, city office and nursery, prayer and quiet rooms, time and dates, and on the phone.
- 43 reading sentences.

## Languages

- English and Arabic (right-to-left). Each student has their own language; the switch on the first screen sets it for new students.
- The Arabic version has its own memory hooks built on Arabic sounds and words, and Arabic meanings for every word and sentence.
- Languages are registered in `js/i18n/locales.js`. To add one, run `python3 scripts/add_language.py fr Français`, then translate the generated locale module. Missing translations use English. See [Adding a language](docs/languages.md) for content dictionaries, RTL support and translation audits.

## Progress and roadmap

- A Progress page per student: letters completed, solid characters, drill accuracy, clean writes, streak and study days; a roadmap through the 14-day plan and on to katakana and JLPT N5; a mastery map of all 104 characters; a 28-day activity calendar; and recent drill rounds.
- A letter can be marked complete once the student has listened to it and written it cleanly 3 times. Completed letters show a small red circle everywhere they appear.

## Student profile

- Details and goals: name, picture (initial, a hiragana, or a photo kept only in the browser), age group, native language, Japanese level, interface language, audio speed, plan length (7, 14 or 21 days), minutes a day, and reason for learning.
- The plan adapts: 7 days merges pairs of days, 21 days adds review days, and task times scale to the daily minutes. The roadmap's last step follows the reason for learning.
- Child mode (age group: child): bigger text and buttons, slow audio, shorter drills and a little more room in the stroke check.
- Appearance: light, dark or same as the device, and 7 background colours (Sage, Sand, Sky, Rose, Lilac, Grey, Plain), each with a light and a dark version. Changes apply at once and are saved per student; new students start with the device's last choice.
- Levels and points from real activity, and 14 achievements with a notice when one is earned.
- Detailed stats: weakest letters with a one-tap drill, accuracy by row, average answer time, minutes studied over the last 7 days against the daily goal, and the letters mixed up most often.

## Students

- Create a student with a name, student ID, password (10 characters minimum), colour and start date. Pick a saved student and enter their password to continue. Reopening the app asks for the password again. Existing profiles ask to set a password on their next login.
- Each student's progress is kept separately in the browser's `localStorage`. With cloud sync configured, changes also save to a private JSON file in Google Drive. A student can sign in on another device with their case-sensitive student ID and password after their first successful cloud save.
- The profile offers **Save to cloud now**, **Restore cloud copy**, export and deletion. Restoring asks for a second tap before replacing local data. Deleting a profile queues deletion of its cloud data as well. Offline changes and deletions wait in a persistent outbox, and the app shows a save or error status. A newer cloud version causes a conflict instead of being overwritten: export local changes before restoring the cloud copy.
- JSON export/import remains available without cloud sync. Imports create a new ID and ask for a new password; exports contain neither passwords nor cloud credentials. Photos stay in the browser.
- Password credentials are derived with PBKDF2/SHA-256 (310,000 iterations, with a distinct salt per student ID). Only a hash of the derived credential is stored on the server. The browser keeps a verifier for offline login and caches the derived credential for background sync. This is a sign-in gate, not encryption of local data: use a trusted browser. There is no password recovery flow yet.
- Clearing site data deletes the local profiles, cached credentials and pending changes. Already-synced data can be read again using the student ID and password. A completed cloud deletion retains only an ownership hash and deletion marker, so delayed saves cannot recreate deleted personal data. Deleted IDs cannot be reused.

## Set up cloud sync

1. Open the Apps Script project behind your web app deployment and replace its code with the entire [Google Apps Script](scripts/google-apps-script.gs). It already points to the configured Drive JSON file; change `FILE_ID` if needed.
2. In Project Settings, add a Script property named `TEACHER_KEY` with a long random password. Keep this key out of the app and repository; it only authorizes the teacher's read-only export.
3. Deploy as a web app, executing as you, with access set to **Anyone**. For an existing deployment, choose **Manage deployments → Edit → New version → Deploy**. Approve Drive access if prompted. The existing web app URL can stay the same.
4. Put that `/exec` URL in [cloud-config.js](js/core/cloud-config.js), then publish the app changes. An empty `SYNC_URL` disables cloud sync. A reachable URL alone is not a working deployment: it must run the updated handlers.
5. Create a disposable student, open Profile, and wait for **Saved to cloud**. In a different browser, use **Sign in with a student ID** to verify both the password and the saved progress. Delete the disposable profile to remove its personal data from the cloud.

The API uses HTTPS plain-text POST bodies containing JSON, keeping student credentials out of URLs. `action` supports `create`, `read`, `update`, `save` (upsert), `delete` and legacy credential migration (`password`). All student operations require the credential that claimed the ID. Reads return the profile, progress and version timestamp, never the ownership hash. Updates use the last-read timestamp to detect conflicts. The existing teacher export is `GET ?key=TEACHER_KEY`; without the correct key it returns `denied`.

## How it works

- Vanilla HTML, CSS and native ES modules, plus an `audio/` folder. No framework, no bundler, no build step, no dependencies apart from Google Fonts. GitHub Pages serves the repository root as it is. See Code structure below.
- Stroke order comes from KanjiVG and is drawn as inline SVG, animated with requestAnimationFrame.
- The Write tab checks each stroke for order, direction, position and shape. Strokes are resampled to 32 points and compared with discrete Fréchet distance; loop direction (for ゜) uses the shoelace formula.
- Works on iPhone and Android: safe areas, no zoom when typing, touch handwriting, sound that is not muted by the silent switch, and it can be added to the Home Screen as an app.
- Audio in `audio/`, 128 kbps / 48 kHz MP3, loaded only when played: each letter on its own (held longer so it is clear), each letter twice followed by an example word (played by Hear), every word and sentence, each daily word with its example sentence, and every phrase. Readings were checked against Open JTalk so the audio matches the hiragana shown.

## Code structure

```
index.html            page shell: loads css/*.css (the load order is the cascade order), then js/main.js
jsconfig.json         type-checking settings (strict); package.json only lists the dev-time TypeScript dependency
types/                shared domain types (progress, students, locales, drill and write state ...), development only
css/                  one file per area (base, components, plan, drill, write, motion, touch-targets ...);
                      ios.css is loaded last and holds the iOS 26 look: filled-tint buttons, glass bars, spring motion,
                      the glass Back capsule and the push / pop page slide
js/
  main.js             entry point: registers screens and entry actions, subscribes achievement notifications,
                      then starts the app
  util.js             DOM and date helpers, shared SVG snippets
  core/
    storage.js        browser JSON persistence only; no application or UI imports
    store.js          students and progress state, v1 normalization, student operations, progress subscriptions
    progress.js       explicit progress actions: answers, writes, listening, completion, rounds, study time
    lesson.js         lesson selectors and actions; completion is saved when an action finishes the lesson
    daily.js          vocabulary selection for the current plan
    pages.js          screen registry supplied by main.js; separates navigation from feature implementations
    ui-state.js       shared view state: current tab, open drill, letter being written ...
    stats.js          read-only statistics, weakest letters and streaks
    audio.js          clip playback (the iOS rules are documented inline), device voice as fallback
    plan.js           the base plan reshaped for the student's pace and daily minutes
    goals.js          the learning goals and which phrase sections each opens ("all" opens everything)
    nav.js            tabs, history entries, back navigation
    motion.js         page and element animation helpers; pageSnapshot() keeps a copy of the page being left so
                      the Back / push slide can show both pages at once (skipped on #test pages)
    render-all.js     re-render the visible pages
  features/           one file per page: plan, lesson, daily, drill, write, read, chart,
                      progress, profile, login, language, gamify (levels, badges, toasts)
  ui/                 shared card renderers, profile fields, student helpers, appearance, bottom-sheet lifecycle,
                      swipe to close, the ひらがな home button, thumb.js (the gliding highlight
                      behind the selected tab or segment),
                      drag-select.js (press and drag along the tab bar or a segmented control),
                      lens.js (the iOS 26 tab bar lens: spring-driven glass that magnifies, stretches with speed and settles on a tab)
  strokes/            stroke drawing (draw.js) and stroke checking (check.js)
  i18n/               locales.js (language registration), core.js (lookup and English fallback),
                      en.js and ar.js (locale definitions), format.js (formatting helpers),
                      ar-content.js, ar-explain.js, helpers.js (localized content), audit.js
  data/               letters, plan, words, phrases, KanjiVG stroke paths, audio manifest
audio/                the clips, keyed by js/data/audio-manifest.js
scripts/              locale scaffolding and translation audits
tests/                dependency checks, Node core tests, Python script tests and Playwright browser suites
```

Conventions:

- The code is type-checked, not compiled. Types are JSDoc comments plus the declarations in `types/`; `tsc --noEmit` checks them under `strict` and nothing is built, so GitHub Pages still serves the source as written. Saved and imported data enters as `unknown` and is validated in `core/store.js` before it becomes a `Progress` or `Student`; interface text is addressed by `StringKey`, so `t('plan.dayOff')` fails the check; `$` and `must` in `util.js` return `HTMLElement` and take a class (`HTMLInputElement`, `SVGElement`) to check anything more specific.
- Shared view state lives in `ui` (`core/ui-state.js`). Screens read progress from `core/store.js` and change it through `core/progress.js` or `core/lesson.js`; student changes use store operations. Only the store persists state. The v1 storage keys and export format remain compatible with existing students.
- `core/` and shared `ui/` modules do not import feature screens. Navigation and bulk rendering use the registry wired in `main.js`. Screen entry actions record visits; rendering does not award progress or save rounds. The dependency check rejects circular imports.
- Storage never calculates achievements or schedules notifications. The entry point subscribes the achievement feature to progress changes; badge writes do not recursively notify the subscriber.
- Interface text lives only in `js/i18n/`, and every key used in code exists in both English and Arabic.
- Locale metadata controls language choices, direction, dates and validation. Learning content uses keyed dictionaries with English fallback. Plan tasks keep durations as numeric data rather than embedding values that code must parse from translated text.
- Everything animated is switched off under `prefers-reduced-motion`.
- The look follows iOS 26: Liquid Glass is approximated with blur, translucency and an edge highlight (CSS has no refraction). The bars fall back to solid fills when `backdrop-filter` is missing or the device asks to reduce transparency.
- Tap targets are at least 44 px. Page height is budgeted with `svh` and `env(safe-area-inset-*)`.

## Run and test locally

```
python3 -m http.server 8000     # then open http://127.0.0.1:8000/
```

Adding `#test` to the URL exposes `window.__hira` for the tests.

Development checks use Node.js 22+ and Python with Playwright. Neither is needed to serve the app on GitHub Pages.

```sh
npm install                     # TypeScript only, for the type check
npm run typecheck
python3 -m venv .venv
.venv/bin/pip install -r tests/requirements.txt
.venv/bin/python -m playwright install chromium
PYTHON=.venv/bin/python tests/run_all.sh --jobs 3
```

The runner serves the repo on port 8767 (`PORT=...` to change), checks module dependencies and types, runs core and script tests, audits locales, and runs every browser suite. It returns a failure status for failed scripts, timeouts or reported browser errors, and saves full per-suite logs in the system temporary directory (`HIRA_TEST_OUTPUT=...` to choose a directory).

Run a subset or just the core checks:

```sh
PYTHON=.venv/bin/python tests/run_all.sh lessontest pftest localetest
npm run test:core
python3 tests/architecture.py
node scripts/check-locales.mjs --strict
```

The suites cover swipe to close and the scroll lock, tap to play, the phrase filter, animations, the guided lesson, profiles with export and import, themes, Arabic layout, overflow at several phone sizes, and audio. The locale test injects additional languages to check registration, fallback, direction and persistence; the rendering test checks that re-rendering does not change progress. Existing browser suites run in Chromium with touch emulation. The new locale and rendering tests also support `BROWSER=webkit` after installing that Playwright browser; this does not replace testing on a real iPhone. `tests/sweep.py`, `tests/fit.py` and `tests/budget.py` are slower layout sweeps to run by hand.

`cloudtest` runs the actual Apps Script handlers against mocked Google services, testing saves, reads in another browser, wrong passwords, updates, conflicts, restore and offline deletion. Normal browser suites disable cloud sync, and these tests never write to the live Drive file. Passing them does not verify deployment permissions, Google redirects or CORS; those require the live save/read check after deployment.

## Credits and terms

- **Stroke order data:** [KanjiVG](https://kanjivg.tagaini.net) by Ulrich Apel, licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The stroke data in `js/data/kvg.js` stays under that licence.
- **Voice:** VOICEVOX:No.7 (announcer style), generated with [VOICEVOX](https://voicevox.hiroshiba.jp/). Under the No.7 terms, the audio may be used non-commercially with this credit; commercial use needs prior confirmation from the [No.7 製作委員会](https://voiceseven.com/).
- **Fonts:** Klee One, Zen Kaku Gothic New and IBM Plex Sans Arabic, via Google Fonts (SIL Open Font License).
