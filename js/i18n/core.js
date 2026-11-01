import { LOCALES } from './locales.js';

export { K, iso } from './format.js';
export const DEFAULT_LANGUAGE = 'en';
export let LANG = DEFAULT_LANGUAGE;
export const STR = {};
const languages = new Map();

export function registerLocale(locale) {
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(locale.id) || !locale.label) {
    throw new Error('A locale needs a language tag and its native display name');
  }
  if (languages.has(locale.id)) throw new Error('Duplicate locale: ' + locale.id);
  if (locale.direction && !['ltr', 'rtl'].includes(locale.direction)) {
    throw new Error('Invalid text direction: ' + locale.id);
  }
  const record = {
    direction: 'ltr',
    dateLocale: locale.id,
    listSeparator: ', ',
    content: {},
    strings: {},
    ...locale,
  };
  languages.set(record.id, record);
  STR[record.id] = record.strings;
}

LOCALES.forEach(registerLocale);

export const localeIds = () => [...languages.keys()];
export const supportedLocale = (id) => languages.has(id);
export const localeFor = (id = LANG) => languages.get(id) || languages.get(DEFAULT_LANGUAGE);
export const localeLabel = (id) => localeFor(id).label;

// Browser preferences may include regional tags; saved student choices match a registered ID.
export function detectLocale(preferences = []) {
  for (const preference of preferences) {
    const tag = preference.toLowerCase();
    const match =
      localeIds().find((id) => id.toLowerCase() === tag) ||
      localeIds().find((id) => id.toLowerCase() === tag.split('-')[0]);
    if (match) return match;
  }
  return DEFAULT_LANGUAGE;
}

export function translate(id, key, values) {
  let text = localeFor(id).strings[key] ?? localeFor(DEFAULT_LANGUAGE).strings[key];
  if (text === '') text = localeFor(DEFAULT_LANGUAGE).strings[key];
  if (text === undefined) return key;
  if (typeof text === 'function') return text(values || {});
  return values ? text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match) : text;
}

export const t = (key, values) => translate(LANG, key, values);

export function replaceLang(id) {
  LANG = supportedLocale(id) ? id : DEFAULT_LANGUAGE;
  return LANG;
}
