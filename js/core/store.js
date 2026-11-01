import { DAILY_ALL } from '../data/daily.js';
import { ALL } from '../data/letters.js';
import { isObject, todayISO } from '../util.js';
import { AGES, JLEVELS, MINUTES, PACES, REASONS } from './goals.js';
import { localeIds, supportedLocale } from '../i18n/core.js';
import {
  readStudents,
  writeStudents,
  readProgress,
  writeProgress,
  deleteProgress,
} from './storage.js';

export const COLORS = ['#2A7361', '#CC3226', '#3C5A99', '#95601A', '#7A4E9C', '#4F6B2E'];
/** @type {readonly import('../../types/app').Tint[]} */
export const TINTS = ['sage', 'sand', 'sky', 'rose', 'lilac', 'slate', 'white'];
/** @type {readonly import('../../types/app').ThemeMode[]} */
export const MODES = ['system', 'light', 'dark'];
const DAY_KEY = /^([1-9]|1[0-9]|2[01])$/;

/**
 * The listed option equal to `value`, or the fallback.
 * @template T
 * @param {readonly T[]} options
 * @param {unknown} value
 * @param {T} fallback
 * @returns {T}
 */
const oneOf = (options, value, fallback) => options.find((option) => option === value) ?? fallback;

/** @param {unknown} x @returns {import('../../types/app').Theme} */
export const cleanTheme = (x) => {
  const theme = isObject(x) ? x : {};
  return { mode: oneOf(MODES, theme.mode, 'system'), tint: oneOf(TINTS, theme.tint, 'sage') };
};
export const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** @param {unknown} value @returns {value is import('../../types/app').ISODate} */
const isISO = (value) => typeof value === 'string' && ISO.test(value);
/** @param {unknown} v */
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
/**
 * Keeps the object-valued entries whose key is allowed, cleaning each value.
 * @template T
 * @param {unknown} o
 * @param {readonly string[]} keys
 * @param {(value: Record<string, unknown>) => T} f
 * @returns {Record<string, T>}
 */
function cleanObjMap(o, keys, f) {
  /** @type {Record<string, T>} */
  const out = {};
  if (isObject(o))
    for (const k of Object.keys(o)) {
      const value = o[k];
      if (keys.includes(k) && isObject(value)) out[k] = f(value);
    }
  return out;
}
export const LETTERS = () => ALL.concat(['ゃ', 'ゅ', 'ょ', 'っ']);
/** @param {unknown} o @returns {Record<string, number>} */
function cleanNum(o) {
  /** @type {Record<string, number>} */
  const out = {};
  if (isObject(o))
    for (const k of Object.keys(o)) if (LETTERS().includes(k) && num(o[k]) > 0) out[k] = num(o[k]);
  return out;
}
/** @param {unknown} o @returns {Record<string, import('../../types/app').ISODate>} */
function cleanDates(o) {
  /** @type {Record<string, import('../../types/app').ISODate>} */
  const out = {};
  if (isObject(o))
    for (const k of Object.keys(o)) {
      const value = o[k];
      if (LETTERS().includes(k) && isISO(value)) out[k] = value;
    }
  return out;
}
/** Keeps the entries keyed by an ISO date that hold a positive number. @param {unknown} o @returns {Record<string, number>} */
function cleanDayCounts(o) {
  /** @type {Record<string, number>} */
  const out = {};
  if (isObject(o))
    for (const k of Object.keys(o)) if (ISO.test(k) && num(o[k]) > 0) out[k] = num(o[k]);
  return out;
}
/** @param {unknown} list @returns {string[]} */
const letterList = (list) =>
  Array.isArray(list)
    ? list.filter((x) => typeof x === 'string' && LETTERS().includes(x))
    : [];
/* Shapes every saved or imported progress record, dropping anything unexpected */
/**
 * The v1 JSON format is kept for existing exports:
 * stats[kana]: b = mastery step, c = correct, w = wrong, t = average milliseconds.
 * ws[kana]: n = completed writes, p = clean writes.
 * les[day]: m = met letters, w = written letters, q = best quiz percent,
 * r = reading visited, d = heard daily words, dd = daily words marked done.
 * @param {unknown} input saved or imported data
 * @returns {import('../../types/app').Progress}
 */
export function normalize(input) {
  /** @type {import('../../types/app').Progress} */
  const f = {
    v: 1,
    start: todayISO(),
    done: {},
    stats: {},
    ws: {},
    act: {},
    rounds: [],
    heard: {},
    cl: {},
    time: {},
    mix: {},
    badges: {},
    les: {},
    updated: 0,
  };
  if (!isObject(input)) return f;
  const s = input;
  /** @type {Record<string, import('../../types/app').ISODate>} */
  const done = {};
  if (isObject(s.done))
    for (const k of Object.keys(s.done)) {
      const value = s.done[k];
      if (DAY_KEY.test(k) && typeof value === 'string') done[k] = value;
    }
  /** @type {Record<string, number>} */
  const mix = {};
  if (isObject(s.mix))
    for (const k of Object.keys(s.mix)) {
      const [x, y] = k.split('>');
      if (LETTERS().includes(x) && LETTERS().includes(y) && num(s.mix[k]) > 0) mix[k] = num(s.mix[k]);
    }
  /** @type {Record<string, import('../../types/app').LessonProgress>} */
  const les = {};
  if (isObject(s.les))
    for (const k of Object.keys(s.les)) {
      const v = s.les[k];
      if (DAY_KEY.test(k) && isObject(v))
        les[k] = {
          m: letterList(v.m),
          w: letterList(v.w),
          q: num(v.q) || (v.q === 0 ? 0 : -1),
          r: !!v.r,
          d: Array.isArray(v.d)
            ? v.d.filter((x) => typeof x === 'string' && DAILY_ALL.some((w) => w[0] === x))
            : [],
          dd: !!v.dd,
        };
    }
  /** @type {Record<string, import('../../types/app').ISODate>} */
  const badges = {};
  if (isObject(s.badges))
    for (const k of Object.keys(s.badges)) {
      const value = s.badges[k];
      if (/^[a-z0-9]{2,10}$/.test(k) && isISO(value)) badges[k] = value;
    }
  return {
    v: 1,
    start: isISO(s.start) ? s.start : f.start,
    done,
    stats: cleanObjMap(s.stats, ALL, (v) => ({
      b: Math.min(5, Math.max(0, num(v.b))),
      c: num(v.c),
      w: num(v.w),
      t: num(v.t),
    })),
    ws: cleanObjMap(s.ws, ALL.concat(['っ']), (v) => ({ n: num(v.n), p: num(v.p) })),
    act: cleanDayCounts(s.act),
    heard: cleanNum(s.heard),
    cl: cleanDates(s.cl),
    time: cleanDayCounts(s.time),
    mix,
    les,
    badges,
    rounds: Array.isArray(s.rounds)
      ? s.rounds
          .filter((r) => isObject(r) && isISO(r.d))
          .map((r) => ({ d: r.d, n: num(r.n), p: Math.min(100, num(r.p)) }))
          .slice(-50)
      : [],
    updated: num(s.updated),
  };
}
/**
 * Validates a student record, replacing anything unexpected with its default.
 * @param {import('../../types/app').RawStudent} p
 * @returns {import('../../types/app').Student}
 */
export function cleanStudent(p) {
  const goal = isObject(p.goal) ? p.goal : {};
  const av = isObject(p.av) ? p.av : null;
  return {
    id: p.id,
    name: p.name.trim().slice(0, 24),
    color: oneOf(COLORS, p.color, COLORS[0]),
    created: isISO(p.created) ? p.created : todayISO(),
    last: num(p.last),
    lang: supportedLocale(p.lang) ? p.lang : null,
    age: oneOf(AGES, p.age, 'adult'),
    native: oneOf([...localeIds(), 'ja', 'other'], p.native, ''),
    jlevel: oneOf(JLEVELS, p.jlevel, 'new'),
    rate: p.rate === 0.75 ? 0.75 : 1,
    theme: cleanTheme(p.theme),
    goal: {
      pace: oneOf(PACES, goal.pace, 14),
      min: oneOf(MINUTES, goal.min, 30),
      reason: oneOf(REASONS, goal.reason, 'jlpt'),
    },
    av: av
      ? {
          t: oneOf(['initial', 'kana', 'photo'], av.t, 'initial'),
          k: typeof av.k === 'string' ? av.k : 'あ',
          img: typeof av.img === 'string' && av.img.length < 200000 ? av.img : '',
        }
      : { t: 'initial', k: 'あ', img: '' },
  };
}
/** @returns {import('../../types/app').StudentList} */
function loadStudents() {
  try {
    const s = readStudents();
    if (isObject(s) && Array.isArray(s.list)) {
      const list = s.list
        .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim())
        .map(cleanStudent);
      return {
        v: 1,
        list,
        current: list.some((p) => p.id === s.current) ? /** @type {string} */ (s.current) : null,
        lang: supportedLocale(s.lang) ? s.lang : null,
      };
    }
  } catch (e) {}
  return { v: 1, list: [], current: null, lang: null };
}
export let students = loadStudents();

export const me = () => students.list.find((p) => p.id === students.current) || null;
export const loadProgress = readProgress;
export let state = normalize(null);

/** @type {Set<() => void>} */
const progressListeners = new Set();
/** @param {() => void} listener @returns {() => boolean} unsubscribe */
export function subscribeProgress(listener) {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

// Progress actions use this boundary. Persistence never imports features or emits UI effects.
/**
 * @param {(progress: import('../../types/app').Progress) => void} change
 * @param {{notify?: boolean, timestamp?: boolean}} [options]
 */
export function updateProgress(change, { notify = true, timestamp = true } = {}) {
  change(state);
  if (timestamp) state.updated = Date.now();
  const student = me();
  if (student) writeProgress(student.id, state);
  if (notify) progressListeners.forEach((listener) => listener());
}

/** @param {unknown} progress @param {{persist?: boolean}} [options] */
export function restoreProgress(progress, { persist = false } = {}) {
  state = normalize(progress);
  const student = me();
  if (persist && student) writeProgress(student.id, state);
}

/** @param {import('../../types/app').RawStudent} student @param {unknown} progress */
export function addStudent(student, progress) {
  const record = cleanStudent(student);
  students.list.push(record);
  students.current = record.id;
  writeStudents(students);
  restoreProgress(progress, { persist: true });
  return record;
}

/** @param {string} id */
export function selectStudent(id) {
  const student = students.list.find((p) => p.id === id);
  if (!student) return null;
  student.last = Date.now();
  students.current = id;
  writeStudents(students);
  restoreProgress(readProgress(id));
  return student;
}

/** @param {string} id @param {import('../../types/app').StudentPatch} patch */
export function updateStudent(id, patch) {
  const student = students.list.find((p) => p.id === id);
  if (!student) return;
  Object.assign(student, cleanStudent({ ...student, ...patch, id }));
  writeStudents(students);
}

/** @param {string} id */
export function removeStudent(id) {
  deleteProgress(id);
  students.list = students.list.filter((p) => p.id !== id);
  if (students.current === id) students.current = null;
  writeStudents(students);
}

export function clearCurrentStudent() {
  students.current = null;
  writeStudents(students);
}

/** @param {unknown} lang */
export function setDeviceLanguage(lang) {
  if (!supportedLocale(lang)) return;
  students.lang = lang;
  writeStudents(students);
}
