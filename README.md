# Hiragana in 14 days

Learn all 104 hiragana in English and Arabic. Includes a 14-day plan, stroke-by-stroke writing practice, drills, and reading practice with audio.

Created by Asem Qaffaf.  
Live: https://asemqaffaf.github.io/hiragana/

<details>
<summary><b>日本語 (Japanese)</b></summary>

### 14日で学ぶひらがな

英語とアラビア語で学べる、全104文字のひらがな学習アプリ。14日間の学習プラン、書き順に沿った筆順練習、ドリル、音声付きのリーディング練習を収録しています。

制作者: Asem Qaffaf  
公開サイト: https://asemqaffaf.github.io/hiragana/

#### バックエンドレス・データベースレスのフルスタック構成 (Google Apps Script + Google Drive)

専用のバックエンドサーバーやデータベースを使わず、無料の Google アカウントだけで複数端末間の学習進捗を同期します。

- **静的サイト:** GitHub Pages でホスト。フレームワークやビルド手順を使わないプレーンな HTML、CSS、JavaScript モジュール構成。
- **サーバーの代わりに Google Apps Script:** 教師の Google アカウント下で動く小さなスクリプト ([`scripts/google-apps-script.gs`](scripts/google-apps-script.gs)) が、Google のインフラ上で保存・読み込み・削除・パスワード再設定のリクエストを処理。
- **データベースの代わりに Google Drive:** 全生徒のデータを教師の Google Drive 内にある非公開の `students.json`（アクセス制限: **制限付き**）1ファイルに保存。書き込み時は Apps Script の `LockService` で排他制御し、同時書き込みによるデータ破損を防止。
- **オフラインファースト:** 変更はまず端末の `localStorage` に保存され、オンライン復帰時にバックグラウンドで同期。
- **安全なパスワード管理:** パスワードはブラウザ側で PBKDF2（310,000回反復）によりハッシュ化。Google Drive には SHA-256 ハッシュのみを保存し、生パスワードは一切保存しません。

##### セットアップ

1. Google Drive に空の非公開 `students.json`（`{}`）を作成し（**制限付き**に設定）、そのファイルIDを [`scripts/google-apps-script.gs`](scripts/google-apps-script.gs) に入力します。
2. スクリプトを [script.google.com](https://script.google.com/) に貼り付け、**スクリプト プロパティ** に `TEACHER_KEY` を設定し、**ウェブアプリ** としてデプロイ（*次のユーザーとして実行: 自分*, *アクセスできるユーザー: 全員*）。
3. 発行された `/exec` URL を GitHub リポジトリの `SYNC_URL` シークレットに登録し、**Pages** のデプロイ元を **GitHub Actions** に設定します。

#### iOS 26 スタイルの UI と快適な UX

- **リキッドグラスデザイン:** 半透明のガラス調バー、ドラッグ可能な拡大鏡付きフローティングタブバー、スワイプで閉じるシート。
- **心地よい操作感:** スプリングアニメーション、書き取りキャンバスのスムーズなタッチ描画、即座に再生される音声。
- **パーソナライズと多言語対応:** 7種類のライト/ダークテーマ、子ども向けモード、英語およびアラビア語（RTL）の完全サポート。

#### ローカルで実行

```sh
python3 -m http.server 8000     # http://127.0.0.1:8000/
```

</details>

<details>
<summary><b>العربية (Arabic)</b></summary>

### تعلم الهيراغانا في 14 يوماً

تعلم جميع حروف الهيراغانا الـ 104 باللغتين العربية والإنجليزية. يتضمن خطة تعليمية لمدة 14 يوماً، وتدريباً على الرسم خطوة بخطوة، وتمارين، وتدريبات قراءة مع الصوت.

تطوير: عاصم قفاف (Asem Qaffaf)  
الموقع: https://asemqaffaf.github.io/hiragana/

#### تطبيق متكامل بدون خادم وبدون قاعدة بيانات (Google Apps Script + Google Drive)

يحفظ التطبيق تقدم الطلاب عبر مختلف الأجهزة دون الحاجة إلى خادم خلفي (Backend) أو قاعدة بيانات، باستخدام حساب Google مجاني فقط:

- **موقع ثابت (Static):** مستضاف على GitHub Pages باستخدام HTML وCSS ووحدات JavaScript نقية، بدون أي أدوات بناء أو أطر عمل.
- **Google Apps Script كبديل للخادم:** كود نصي بسيط ([`scripts/google-apps-script.gs`](scripts/google-apps-script.gs)) يعمل على بنية Google التحتية ضمن حساب المعلم، ويتولى معالجة طلبات الحفظ والقراءة والحذف وإعادة تعيين كلمة المرور.
- **Google Drive كبديل لقاعدة البيانات:** تُحفظ بيانات جميع الطلاب في ملف خاص واحد `students.json` داخل Google Drive الخاص بالمعلم (بصلاحية **خاص / Restricted**). ويستخدم Apps Script ميزة القفل (`LockService`) أثناء الكتابة لمنع تعارض الحفظ المتزامن بين الطلاب.
- **العمل دون اتصال أولاً (Offline-first):** تُحفظ التغييرات في `localStorage` أولاً ثم تتم المزامنة في الخلفية عند توفر الاتصال بالإنترنت.
- **أمان كلمات المرور:** يتم تجزئة كلمات المرور في المتصفح باستخدام PBKDF2 (بـ 310,000 تكرار)، ولا يُخزن في Google Drive سوى تجزئة SHA-256 دون حفظ كلمة المرور الأصلية مطلقاً.

##### الإعداد

1. أنشئ ملفاً خاصاً باسم `students.json` محتواه `{}` في Google Drive (مضبوط على **خاص / Restricted**)، ثم ضع معرف الملف في [`scripts/google-apps-script.gs`](scripts/google-apps-script.gs).
2. الصق الكود في [script.google.com](https://script.google.com/)، وأضف `TEACHER_KEY` في **خصائص المشروع (Script Properties)**، ثم انشر كتطبيق ويب (**Web app**) (*التنفيذ بصفتي: أنا*, *إمكانية الوصول: أي شخص*).
3. أضف رابط `/exec` كـ secret باسم `SYNC_URL` في إعدادات GitHub، واضبط نشر **Pages** ليكون عبر **GitHub Actions**.

#### واجهة مستخدم بنمط iOS 26 مع تجربة استخدام رائعة

- **تصميم الزجاج السائل (Liquid Glass):** أشرطة زجاجية شبه شفافة، وشريط تنقل عائم مزود بعدسة مكبرة قابلة للسحب، وبطاقات تنزلق للإغلاق.
- **تفاعل سلس:** حركة فيزيائية مرنة (Spring motion)، ورسم تفاعلي بالقلم على لوحة الكتابة، وتشغيل فوري للصوت.
- **تخصيص كامل ودعم اللغات:** 7 سمات مظهرية فاتحة وداكنة، ووضع خاص بالأطفال (Child Mode)، ودعم كامل للغتين الإنجليزية والعربية (اتجاه من اليمين لليسار RTL).

#### التشغيل محلياً

```sh
python3 -m http.server 8000     # http://127.0.0.1:8000/
```

</details>

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
