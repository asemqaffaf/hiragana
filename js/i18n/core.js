import { LOCALES } from './locales.js';

export { K, iso } from './format.js';
export const DEFAULT_LANGUAGE = 'en';
/** The active language. Read it through `t`, or import the binding and read it live. */
export let LANG = DEFAULT_LANGUAGE;
/** @type {Record<string, import('../../types/app').LocaleDefinition['strings']>} */
export const STR = {};
/** @type {Map<string, import('../../types/app').Locale>} */
const languages = new Map();

/** @param {import('../../types/app').LocaleDefinition} locale */
export function registerLocale(locale) {
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(locale.id) || !locale.label) {
    throw new Error('A locale needs a language tag and its native display name');
  }
  if (languages.has(locale.id)) throw new Error('Duplicate locale: ' + locale.id);
  if (locale.direction && !['ltr', 'rtl'].includes(locale.direction)) {
    throw new Error('Invalid text direction: ' + locale.id);
  }
  /** @type {import('../../types/app').Locale} */
  const record = {
    direction: 'ltr',
    dateLocale: locale.id,
    listSeparator: ', ',
    content: {},
    ...locale,
  };
  languages.set(record.id, record);
  STR[record.id] = record.strings;
}

LOCALES.forEach(registerLocale);

export const localeIds = () => [...languages.keys()];
/** @param {unknown} id @returns {id is string} */
export const supportedLocale = (id) => typeof id === 'string' && languages.has(id);

/**
 * The locale for an id, or English when it is unknown.
 * @param {string} [id]
 * @returns {import('../../types/app').Locale}
 */
export function localeFor(id = LANG) {
  const locale = languages.get(id) || languages.get(DEFAULT_LANGUAGE);
  if (!locale) throw new Error('The default locale is not registered');
  return locale;
}
/** @param {string} id */
export const localeLabel = (id) => localeFor(id).label;

// Browser preferences may include regional tags; saved student choices match a registered ID.
/** @param {readonly string[]} [preferences] */
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

/** Whether `key` names a single interface string; for keys that are only known at run time. @param {string} key @returns {key is import('../../types/app').TextKey} */
export const hasKey = (key) => {
  const text = /** @type {import('../../types/app').LocaleDefinition['strings']} */ (
    localeFor(DEFAULT_LANGUAGE).strings
  )[key];
  return text !== undefined && !Array.isArray(text);
};

/**
 * The entry for a key in one language, with English as the fallback. Empty strings count as missing.
 * @param {string} id
 * @param {import('../../types/app').StringKey} key
 * @returns {import('../../types/app').LocaleString | undefined}
 */
function lookup(id, key) {
  const text = localeFor(id).strings[key];
  return text == null || text === '' ? localeFor(DEFAULT_LANGUAGE).strings[key] : text;
}

/**
 * @param {string} id
 * @param {import('../../types/app').TextKey} key
 * @param {import('../../types/app').Interpolation} [values]
 * @returns {string}
 */
export function translate(id, key, values) {
  const text = lookup(id, key);
  if (text === undefined) return key;
  if (typeof text === 'function') return text(values || {});
  if (typeof text !== 'string') return text.join(' ');
  return values ? text.replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match)) : text;
}

/** The paragraphs of a list-valued string. @param {import('../../types/app').ListKey} key @returns {readonly string[]} */
export function tList(key) {
  const text = lookup(LANG, key);
  return Array.isArray(text) ? text : [];
}

/**
 * @param {import('../../types/app').TextKey} key
 * @param {import('../../types/app').Interpolation} [values]
 */
export const t = (key, values) => translate(LANG, key, values);

/** Makes a language the active one; an unknown id means English. @param {unknown} id */
export function replaceLang(id) {
  LANG = supportedLocale(id) ? id : DEFAULT_LANGUAGE;
  return LANG;
}
