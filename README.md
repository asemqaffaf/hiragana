**言語:** **日本語** · [English](README.en.md) · [العربية](README.ar.md)

# ひらがな — Hiragana in 14 days

基本の46文字、濁音・半濁音25文字、拗音33種類の計104文字・組み合わせを学べるひらがな学習アプリです。レッスン、筆順練習、リスニングドリル、日本語音声付きの読解練習で、読み書きと文字の識別を身につけます。

[**学習を始める →**](https://asemqaffaf.github.io/hiragana/) · [言語の追加](docs/languages.md)

制作者: Asem Qaffaf。HTML、CSS、JavaScript モジュールで構成されており、フレームワーク、ビルド手順、実行時のパッケージ依存関係はありません。

## 主な機能

- **学習プラン:** 7日・14日・21日のペースと、1日の学習時間を選択できます。
- **書き取り練習:** 筆順を確認し、タッチ操作に対応したキャンバスで練習できます。
- **文字と音のドリル:** かなの読み、選択式問題、日本語音声で練習できます。
- **文脈の中で読む練習:** 単語、フレーズ、例文を翻訳とともに学べます。
- **進捗管理:** 生徒別プロフィール、苦手な文字の復習、データのエクスポート・インポートに対応しています。
- **表示のカスタマイズ:** 7色のテーマ、ライト・ダーク・システム連動、子ども向けモードを選べます。半透明のガラス調デザインとフローティングタブバーを採用しています。

## 対応言語

README の言語とアプリ画面の対応言語は異なります。

| 言語 | README | アプリ画面 |
| --- | --- | --- |
| 日本語 | このページ | 現時点では未対応 |
| English | [English](README.en.md) | 対応（左から右） |
| العربية | [العربية](README.ar.md) | 対応（右から左） |

最初の画面で言語を選択でき、プロフィールから変更することもできます。サインイン前は端末に保存された言語、またはブラウザの言語設定から対応言語を選び、該当しなければ英語を使用します。生徒ごとに言語設定を保存します。

言語は [`js/i18n/locales.js`](js/i18n/locales.js) に登録します。言語選択、文字の方向、日付の書式は各言語のメタデータを参照します。未翻訳の画面テキストや学習コンテンツは英語にフォールバックするため、段階的に翻訳できます。

### 翻訳を追加する

リポジトリのルートで、言語タグとその言語での表示名を指定します。

```sh
python3 scripts/add_language.py fr Français
```

`js/i18n/fr.js` が作成・登録され、言語選択に表示されます。`strings` と `content` を翻訳し、`{name}` や `{n}` などのプレースホルダーは保持してください。右から左に書く言語には、作成コマンドに `--direction rtl` を追加します。

```sh
node scripts/check-locales.mjs fr
node scripts/check-locales.mjs fr --strict
```

通常の監査は未翻訳を許容し、`--strict` は未翻訳の画面テキストもエラーにします。どちらも不明なキー、値の型の誤り、プレースホルダーの不一致を検出します。対象は画面テキストであり、学習コンテンツの翻訳は別途確認してください。

辞書形式、複数形、地域別言語タグ、ブラウザでの確認方法は[翻訳ガイド（英語）](docs/languages.md)を参照してください。共通の説明を変更するときは3つの README を揃え、新しい翻訳版を追加したら言語リンクも更新してください。

## ローカルで実行

リポジトリを取得し、そのディレクトリで HTTP サーバーを起動します。

```sh
git clone https://github.com/asemqaffaf/hiragana.git
cd hiragana
python3 -m http.server 8000
```

[http://localhost:8000/](http://localhost:8000/) を開きます。アプリの配信には Python 3 だけで十分です。Node.js は開発用チェックにのみ必要です。JavaScript モジュールを読み込むため、ローカルサーバーを使用してください。

進捗はブラウザの `localStorage` に保存されます。ローカルの初期状態ではクラウド同期は無効です。同期を使わない場合は、ブラウザのデータを消去したり別のブラウザに移ったりする前に、プロフィールをエクスポートしてください。

## クラウド同期（任意）

クラウドの設定なしでもローカルで使えます。複数端末で進捗を共有する場合は、付属の [Google Apps Script](scripts/google-apps-script.gs) をバックエンドとして使用し、Google Drive の非公開 JSON ファイルに生徒データを保存します。別途サーバーやデータベースサービスを用意する必要はありません。

1. Google Drive に内容が `{}` の `students.json` を作成し、アクセスを **制限付き** にします。
2. Apps Script プロジェクトを作成し、[`scripts/google-apps-script.gs`](scripts/google-apps-script.gs) を貼り付け、`FILE_ID` を自分のファイル ID に置き換えます。
3. **プロジェクトの設定 → スクリプト プロパティ** で、`TEACHER_KEY` に長いランダムなパスワードを設定します。
4. **ウェブアプリ** として、**次のユーザーとして実行: 自分**、**アクセスできるユーザー: 全員** でデプロイし、`/exec` URL をコピーします。
5. GitHub リポジトリの **Settings → Secrets and variables → Actions** に、その URL を `SYNC_URL` リポジトリシークレットとして追加します。**Settings → Pages → Source** を **GitHub Actions** にします。
6. `main` にプッシュするか、[Pages ワークフロー](.github/workflows/pages.yml)を手動実行します。公開時に同期 URL が挿入されます。シークレットがない場合は同期なしで公開されます。

ローカルで同期を試す場合は、[`js/core/cloud-config.js`](js/core/cloud-config.js) の `SYNC_URL` にウェブアプリの URL を設定し、その変更はコミットに含めないでください。Apps Script のコードを変更したら、新しいバージョンをデプロイします。

変更はまず端末に保存され、オンライン時の同期キューに入ります。Apps Script は `LockService` で書き込みを直列化し、レコードのバージョンで保存の競合を検出します。パスワードからブラウザ内で PBKDF2-SHA-256（310,000回反復）により認証情報を導出し、Drive にはその SHA-256 ハッシュを保存します。元のパスワードは保存しません。同期先 URL は公開クライアントに含まれますが、`TEACHER_KEY` は Apps Script のプロパティだけに設定します。

## 開発用チェック

開発ツールをインストールし、基本的なチェックを実行します。

```sh
npm install
npm run typecheck
npm run test:core
node scripts/check-locales.mjs --strict
```

ブラウザで言語機能を確認するには、仮想環境に Playwright をインストールします。

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/requirements.txt
.venv/bin/python -m playwright install chromium
PYTHON=.venv/bin/python tests/run_all.sh localetest --jobs 1
```

テストランナーがローカルサーバーを起動します。`localetest` を省略すると全ブラウザテストを実行します。WebKit での確認方法は [`docs/languages.md`](docs/languages.md) を参照してください。

## クレジット

- 筆順データ: [KanjiVG](https://kanjivg.tagaini.net)（[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)）。
- 日本語音声: VOICEVOX:No.7（[VOICEVOX](https://voicevox.hiroshiba.jp/)）。
- フォント: クレー One、ゼン角ゴシック New、IBM Plex Sans Arabic（Google Fonts）。
