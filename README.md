# Hiragana in 14 days

A study kit for all 104 hiragana, in English and Arabic,: a 14-day plan, a chart with memory hooks and animated stroke order, drills (read, choose, listen), handwriting practice that checks every stroke, and JLPT N5-level reading practice with recorded audio.

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

- Passwordless login: pick your name on the first screen, or add a new student (name, colour, start date).
- Each student's progress is kept separately in the browser's `localStorage`. There is no server and no database, so progress stays on the device and browser where it was made.
- To move a student to another device, open the profile, tap **Export progress** to download a JSON file, then use **Import a student from a file** on the other device.
- Clearing site data in the browser deletes all students on that device.

## How it works

- Vanilla HTML, CSS and native ES modules, plus an `audio/` folder. No framework, no bundler, no build step, no dependencies apart from Google Fonts. GitHub Pages serves the repository root as it is. See Code structure below.
- Stroke order comes from KanjiVG and is drawn as inline SVG, animated with requestAnimationFrame.
- The Write tab checks each stroke for order, direction, position and shape. Strokes are resampled to 32 points and compared with discrete Fréchet distance; loop direction (for ゜) uses the shoelace formula.
- Works on iPhone and Android: safe areas, no zoom when typing, touch handwriting, sound that is not muted by the silent switch, and it can be added to the Home Screen as an app.
- Audio in `audio/`, 128 kbps / 48 kHz MP3, loaded only when played: each letter on its own (held longer so it is clear), each letter twice followed by an example word (played by Hear), every word and sentence, each daily word with its example sentence, and every phrase. Readings were checked against Open JTalk so the audio matches the hiragana shown.

## Code structure

```
index.html            page shell: loads css/*.css (the load order is the cascade order), then js/main.js
css/                  one file per area (base, components, plan, drill, write, motion, touch-targets ...);
                      ios.css is loaded last and holds the iOS 26 look: filled-tint buttons, glass bars, spring motion,
                      the glass Back capsule and the push / pop page slide
js/
  main.js             entry point: imports everything and starts the app
  util.js             DOM and date helpers, shared SVG snippets
  core/
    storage.js        students, progress state, normalising and saving, theme
    ui-state.js       shared view state: current tab, open drill, letter being written ...
    stats.js          per-letter statistics, weakest letters
    audio.js          clip playback (the iOS rules are documented inline), device voice as fallback
    plan.js           the base plan reshaped for the student's pace and daily minutes
    goals.js          the learning goals and which phrase sections each opens ("all" opens everything)
    nav.js            tabs, history entries, back navigation
    motion.js         page and element animation helpers; pageSnapshot() keeps a copy of the page being left so
                      the Back / push slide can show both pages at once (skipped on #test pages)
    render-all.js     re-render the visible pages
  features/           one file per page: plan, lesson, daily, drill, write, read, chart,
                      progress, profile, login, language, gamify (levels, badges, toasts)
  ui/                 bottom sheets, swipe to close, the ひらがな home button, thumb.js (the gliding highlight
                      behind the selected tab or segment)
  strokes/            stroke drawing (draw.js) and stroke checking (check.js)
  i18n/               core.js (t(), plurals), en.js, ar.js, ar-content.js, helpers.js
  data/               letters, plan, words, phrases, KanjiVG stroke paths, audio manifest
audio/                the clips, keyed by js/data/audio-manifest.js
tests/                Playwright (Python) suites that run in Chromium
```

Conventions:

- Shared view state lives in `ui` (`core/ui-state.js`). The data model (`state`, `students`, `LANG`) is exported by the module that owns it; other modules read it and replace it with `replaceState` and `replaceLang`.
- Interface text lives only in `js/i18n/`, and every key used in code exists in both English and Arabic.
- Everything animated is switched off under `prefers-reduced-motion`.
- The look follows iOS 26: Liquid Glass is approximated with blur, translucency and an edge highlight (CSS has no refraction). The bars fall back to solid fills when `backdrop-filter` is missing or the device asks to reduce transparency.
- Tap targets are at least 44 px. Page height is budgeted with `svh` and `env(safe-area-inset-*)`.

## Run and test locally

```
python3 -m http.server 8000     # then open http://127.0.0.1:8000/
```

Adding `#test` to the URL exposes `window.__hira` for the tests.

```
pip install playwright && playwright install chromium
tests/run_all.sh                # serves the repo on port 8767 (PORT=... to change) and runs every suite
```

The suites cover swipe to close and the scroll lock, tap to play, the phrase filter, animations, the guided lesson, profiles with export and import, themes, Arabic layout, overflow at several phone sizes, and audio (every clip in the manifest exists and plays). They run in Chromium with touch emulation, so WebKit and real iPhone behaviour are not covered. `tests/sweep.py`, `tests/fit.py` and `tests/budget.py` are slower layout sweeps to run by hand.

## Credits and terms

- **Stroke order data:** [KanjiVG](https://kanjivg.tagaini.net) by Ulrich Apel, licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The stroke data in `js/data/kvg.js` stays under that licence.
- **Voice:** VOICEVOX:No.7 (announcer style), generated with [VOICEVOX](https://voicevox.hiroshiba.jp/). Under the No.7 terms, the audio may be used non-commercially with this credit; commercial use needs prior confirmation from the [No.7 製作委員会](https://voiceseven.com/).
- **Fonts:** Klee One, Zen Kaku Gothic New and IBM Plex Sans Arabic, via Google Fonts (SIL Open Font License).
