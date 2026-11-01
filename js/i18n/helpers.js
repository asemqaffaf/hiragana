import { EXAMPLES } from '../data/content.js';
import { explainEn } from '../data/letters.js';
import { localeFor } from './core.js';
import { isoToUTC } from '../util.js';

// Japanese text is the dictionary key. Locale content can be translated incrementally.
export function meanOf(word, section = 'meanings') {
  const content = localeFor().content;
  return (
    content[section]?.[word[0]] ??
    content.meanings?.[word[0]] ??
    content.sentences?.[word[0]] ??
    word[2]
  );
}

export function exampleMeaning(kana) {
  const word = EXAMPLES[kana];
  return localeFor().content.examples?.[kana] ?? meanOf(word);
}

export function dailySentenceMeaning(word) {
  const content = localeFor().content;
  return content.dailySentences?.[word[0]] ?? content.sentences?.[word[5]] ?? word[7];
}

export const wtitleOf = (group) => localeFor().content.wordTitles?.[group.id] ?? group.title;
export const phraseTitle = (group) => localeFor().content.phraseTitles?.[group.id] ?? group.en;

export function explain(kana) {
  const content = localeFor().content;
  return content.hooks?.[kana] ?? content.explain?.(kana) ?? explainEn(kana);
}

export function fmt(iso, long) {
  const date = new Date(isoToUTC(iso));
  return date.toLocaleDateString(
    localeFor().dateLocale,
    long
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
      : { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' },
  );
}
