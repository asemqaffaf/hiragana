# Hiragana in 14 days

A single-page study kit for all 104 hiragana: a 14-day plan, a chart with memory hooks and animated stroke order, drills (read, choose, listen), handwriting practice that checks every stroke, and JLPT N5-level reading practice with recorded audio.

Live: https://asemqaffaf.github.io/hiragana/

## Students

- Passwordless login: pick your name on the first screen, or add a new student (name, colour, start date).
- Each student's progress is kept separately in the browser's `localStorage`. There is no server and no database, so progress stays on the device and browser where it was made.
- To move a student to another device, open the profile, tap **Export progress** to download a JSON file, then use **Import a student from a file** on the other device.
- Clearing site data in the browser deletes all students on that device.

## How it works

- One self-contained `index.html`: vanilla HTML, CSS and JavaScript. No framework, no build step, no dependencies apart from two Google Fonts.
- Stroke order comes from KanjiVG and is drawn as inline SVG, animated with the Web Animations API.
- The Write tab checks each stroke for order, direction, position and shape. Strokes are resampled to 32 points and compared with discrete Fréchet distance; loop direction (for ゜) uses the shoelace formula.
- 211 audio clips (every character, word and sentence) are embedded as base64 MP3.

## Credits and terms

- **Stroke order data:** [KanjiVG](https://kanjivg.tagaini.net) by Ulrich Apel, licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The stroke data embedded in `index.html` stays under that licence.
- **Voice:** VOICEVOX:No.7 (announcer style), generated with [VOICEVOX](https://voicevox.hiroshiba.jp/). Under the No.7 terms, the audio may be used non-commercially with this credit; commercial use needs prior confirmation from the [No.7 製作委員会](https://voiceseven.com/).
- **Fonts:** Klee One and Zen Kaku Gothic New, via Google Fonts (SIL Open Font License).
