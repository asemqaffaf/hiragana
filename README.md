# Hiragana in 14 days

Learn all 104 hiragana in English and Arabic. Includes a 14-day plan, stroke-by-stroke writing practice, drills, and reading practice with audio.

Created by Asem Qaffaf.  
Live: https://asemqaffaf.github.io/hiragana/

## Backend-less and database-less full-stack application (Google Apps Script + Google Drive)

The app saves student progress across devices without a backend server or a database, using only a free Google account:

- **Static site:** Hosted on GitHub Pages with plain HTML, CSS, and JavaScript modules. No build step and no framework.
- **Google Apps Script instead of a server:** A small script ([`scripts/google-apps-script.gs`](scripts/google-apps-script.gs)) runs on Google's infrastructure under the teacher's Google account and handles save, read, delete, and password reset requests.
- **Google Drive instead of a database:** All students are saved in one private `students.json` file in the teacher's Google Drive (set to **Restricted**). Apps Script locks the file (`LockService`) on each write so two students saving at once never overwrite each other.
- **Offline-first:** Changes save to `localStorage` first and sync in the background when online.
- **Password protection:** Passwords are hashed in the browser with PBKDF2 (310,000 iterations). Only a SHA-256 hash is stored in Drive, never the password.

### Setup

1. Create a private `students.json` file (`{}`) in Google Drive (set to **Restricted**) and put its file ID in [`scripts/google-apps-script.gs`](scripts/google-apps-script.gs).
2. Paste the script into [script.google.com](https://script.google.com/), add `TEACHER_KEY` in **Script Properties**, and deploy as a **Web app** (*Execute as: Me*, *Access: Anyone*).
3. Add the `/exec` URL as the `SYNC_URL` secret on GitHub and set **Pages** to deploy from **GitHub Actions**.

## iOS 26 UI with wonderful UX

- **Liquid Glass design:** Translucent glass bars, floating tab bar with a draggable magnifying lens, and swipe-to-close sheets.
- **Smooth interactions:** Spring motion, responsive touch drawing on the writing canvas, and instant audio playback.
- **Personalised & bilingual:** 7 light/dark themes, Child Mode, and full English and Arabic (RTL) support.

## Run locally

```sh
python3 -m http.server 8000     # http://127.0.0.1:8000/
```

## Credits

- Stroke data: [KanjiVG](https://kanjivg.tagaini.net) ([CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/))
- Voice: VOICEVOX:No.7 ([VOICEVOX](https://voicevox.hiroshiba.jp/))
- Fonts: Klee One, Zen Kaku Gothic New, IBM Plex Sans Arabic (Google Fonts)
