# Adding a language

Run this from the repository root:

```sh
python3 scripts/add_language.py fr Français
```

This creates `js/i18n/fr.js` and registers it in `js/i18n/locales.js`. Edit the new file to translate the app. The language automatically appears on the first screen and in profiles, survives reload/export/import, and uses English for anything not translated yet. GitHub Pages serves it directly; no build or backend is needed. Existing students keep their saved language.

For a language written right to left:

```sh
python3 scripts/add_language.py he עברית --direction rtl
```

Regional language tags and date formatting can be specified separately:

```sh
python3 scripts/add_language.py pt-BR Português --date-locale pt-BR
```

## Interface translations

Use the keys from `js/i18n/en.js` in the locale's `strings` object. Preserve placeholders such as `{name}`, `{n}` and `{total}`:

```js
export default {
  id: 'fr',
  label: 'Français', // The name as its speakers write it.
  direction: 'ltr',
  dateLocale: 'fr-FR',
  listSeparator: ', ',
  strings: {
    'login.create': 'Créer un profil',
    'plan.dayOf': 'Jour {n} sur {total}',
    'duration.minutes': '{n} min',
    'strokes': ({ n }) => `${n} ${n === 1 ? 'trait' : 'traits'}`,
  },
  content: {},
};
```

Entries may be strings or functions receiving the interpolation values. Preserve arrays where the English entry is an array, such as `read.rules`. For languages with several plural forms, functions can use `Intl.PluralRules`. The English and Arabic modules contain examples. Language names and text direction come from locale metadata; there is no need to add `lang.fr` keys to every other language.

Check progress and placeholder mistakes with:

```sh
node scripts/check-locales.mjs fr
node scripts/check-locales.mjs fr --strict
```

The default audit reports untranslated keys while allowing English fallback; empty strings also use English. `--strict` also fails when a translation is missing. Unknown keys, changed placeholders and incorrect value types fail in either mode. Function entries are executable code: test their plural forms separately.

## Learning content

Translate content incrementally in the same locale module, or import it from a separate file. Dictionaries use Japanese text as keys, so adding a language never requires adding another column to shared vocabulary arrays.

```js
content: {
  meanings: { 'いえ': 'maison' },
  sentences: { 'いえに かえります。': 'Je rentre à la maison.' },
  hooks: { 'あ': 'Your memory hook for あ.' },
  wordTitles: { w1: 'Avec les 46 caractères de base' },
  phraseTitles: { greet: 'Salutations' },
  plan: [
    {
      t: 'Rangées あ et か',
      tasks: [
        { text: 'Écoutez chaque caractère.', minutes: 10 },
        { text: 'Écrivez chaque caractère.', minutes: 10 },
        { text: 'Faites le quiz.', minutes: 10 },
      ],
    },
  ],
}
```

`meanings`, `sentences` and `hooks` cover the common cases. These optional dictionaries allow more specific wording:

| Field | Key | Value |
| --- | --- | --- |
| `examples` | Character, e.g. `あ` | Meaning of its main example word |
| `extraMeanings` | Japanese word | Meaning of an extra example |
| `dailyMeanings` | Japanese word | Meaning in the daily vocabulary |
| `dailySentences` | Japanese word | Translation of that word's example sentence |
| `phraseMeanings` | Full Japanese phrase | Phrase translation |
| `wordTitles` | Word-group ID | Section title |
| `phraseTitles` | Phrase-group ID | Section title |

Specific dictionaries take precedence over general meanings. Missing entries fall back to the general dictionaries, then the English source. If a locale needs generated explanations for combinations, it can supply `content.explain(kana)`; returning `undefined` uses the English explanation.

`content.plan` follows the 14 base days. Individual days, titles or task lists can be omitted to use English. `content.review` can provide a review-day title (`t`) and tasks for the 21-day plan. Keep durations in the numeric `minutes` field: the app scales them and formats them through `duration.minutes`. Plain task strings are supported but have no scalable duration.

## Verification

```sh
node --test tests/i18n.test.mjs
PYTHON=.venv/bin/python tests/run_all.sh localetest --jobs 1
```

`localetest` injects a partial French locale and an additional RTL locale to check automatic selection, content fallback, profile choices, reload, export and import. To check the same flow in WebKit, install that Playwright browser and set `BROWSER=webkit` for the command above.
