| 🇯🇵 **日本語** | [🇬🇧 **English**](README.en.md) | [🇸🇦 **العربية**](README.ar.md) |
| :---: | :---: | :---: |

# ひらがな Hiragana in 14 days

英語とアラビア語で学べる、全104文字のひらがな学習アプリ。14日間の学習プラン、書き順に沿った筆順練習、ドリル、音声付きのリーディング練習を収録しています。

制作者: Asem Qaffaf  
公開サイト: https://asemqaffaf.github.io/hiragana/

## バックエンドレス・データベースレスのフルスタック構成 (Google Apps Script + Google Drive)

専用のバックエンドサーバーやデータベースを使わず、無料の Google アカウントだけで複数端末間の学習進捗を同期します。

- **静的サイト:** GitHub Pages でホスト。フレームワークやビルド手順を使わないプレーンな HTML、CSS、JavaScript モジュール構成。
- **サーバーの代わりに Google Apps Script:** 教師の Google アカウント下で動く小さなスクリプト ([`scripts/google-apps-script.gs`](scripts/google-apps-script.gs)) が、Google のインフラ上で保存・読み込み・削除・パスワード再設定のリクエストを処理。
- **データベースの代わりに Google Drive:** 全生徒のデータを教師の Google Drive 内にある非公開の `students.json`（アクセス制限: **制限付き**）1ファイルに保存。書き込み時は Apps Script の `LockService` で排他制御し、同時書き込みによるデータ破損を防止。
- **オフラインファースト:** 変更はまず端末の `localStorage` に保存され、オンライン復帰時にバックグラウンドで同期。
- **安全なパスワード管理:** パスワードはブラウザ側で PBKDF2（310,000回反復）によりハッシュ化。Google Drive には SHA-256 ハッシュのみを保存し、生パスワードは一切保存しません。

### セットアップ

1. Google Drive に空の非公開 `students.json`（`{}`）を作成し（**制限付き**に設定）、そのファイルIDを [`scripts/google-apps-script.gs`](scripts/google-apps-script.gs) に入力します。
2. スクリプトを [script.google.com](https://script.google.com/) に貼り付け、**スクリプト プロパティ** に `TEACHER_KEY` を設定し、**ウェブアプリ** としてデプロイ（*次のユーザーとして実行: 自分*, *アクセスできるユーザー: 全員*）。
3. 発行された `/exec` URL を GitHub リポジトリの `SYNC_URL` シークレットに登録し、**Pages** のデプロイ元を **GitHub Actions** に設定します。

## iOS 26 スタイルの UI と快適な UX

- **リキッドグラスデザイン:** 半透明のガラス調バー、ドラッグ可能な拡大鏡付きフローティングタブバー、スワイプで閉じるシート。
- **心地よい操作感:** スプリングアニメーション、書き取りキャンバスのスムーズなタッチ描画、即座に再生される音声。
- **パーソナライズと多言語対応:** 7種類のライト/ダークテーマ、子ども向けモード、英語およびアラビア語（RTL）の完全サポート。

## ローカルで実行

```sh
python3 -m http.server 8000     # http://127.0.0.1:8000/
```

## クレジット

- 筆順データ: [KanjiVG](https://kanjivg.tagaini.net) ([CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/))
- 音声: VOICEVOX:No.7 ([VOICEVOX](https://voicevox.hiroshiba.jp/))
- フォント: クレー One, ゼン角ゴシック New, IBM Plex Sans Arabic (Google Fonts)
