import { DAILY_ALL } from '../data/daily.js';
import { ALL } from '../data/letters.js';
import { todayISO } from '../util.js';
import { REASONS } from './goals.js';
import { localeIds, supportedLocale } from '../i18n/core.js';
import {
  readStudents,
  writeStudents,
  readProgress,
  writeProgress,
  deleteProgress,
} from './storage.js';

export const COLORS = ['#2A7361', '#CC3226', '#3C5A99', '#95601A', '#7A4E9C', '#4F6B2E'];
export const TINTS = ['sage', 'sand', 'sky', 'rose', 'lilac', 'slate', 'white'],
  MODES = ['system', 'light', 'dark'];
export const cleanTheme = (x) => ({
  mode: MODES.includes(x && x.mode) ? x.mode : 'system',
  tint: TINTS.includes(x && x.tint) ? x.tint : 'sage',
});
export const ISO = /^\d{4}-\d{2}-\d{2}$/;
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
function cleanObjMap(o, keys, f) {
  const out = {};
  if (o && typeof o === 'object')
    for (const k of Object.keys(o))
      if (keys.includes(k) && o[k] && typeof o[k] === 'object') out[k] = f(o[k]);
  return out;
}
export const LETTERS = () => ALL.concat(['ゃ', 'ゅ', 'ょ', 'っ']);
function cleanNum(o) {
  const out = {};
  if (o && typeof o === 'object')
    for (const k of Object.keys(o)) if (LETTERS().includes(k) && num(o[k]) > 0) out[k] = num(o[k]);
  return out;
}
function cleanDates(o) {
  const out = {};
  if (o && typeof o === 'object')
    for (const k of Object.keys(o)) if (LETTERS().includes(k) && ISO.test(o[k])) out[k] = o[k];
  return out;
}
/* Shapes every saved or imported progress record, dropping anything unexpected */
/**
 * The v1 JSON format is kept for existing exports:
 * stats[kana]: b = mastery step, c = correct, w = wrong, t = average milliseconds.
 * ws[kana]: n = completed writes, p = clean writes.
 * les[day]: m = met letters, w = written letters, q = best quiz percent,
 * r = reading visited, d = heard daily words, dd = daily words marked done.
 */
export function normalize(s) {
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
  if (!s || typeof s !== 'object') return f;
  const done = {},
    act = {};
  if (s.done && typeof s.done === 'object')
    for (const k of Object.keys(s.done))
      if (/^([1-9]|1[0-9]|2[01])$/.test(k) && typeof s.done[k] === 'string') done[k] = s.done[k];
  if (s.act && typeof s.act === 'object')
    for (const k of Object.keys(s.act))
      if (ISO.test(k) && num(s.act[k]) > 0) act[k] = num(s.act[k]);
  return {
    v: 1,
    start: ISO.test(s.start) ? s.start : f.start,
    done,
    stats: cleanObjMap(s.stats, ALL, (v) => ({
      b: Math.min(5, Math.max(0, num(v.b))),
      c: num(v.c),
      w: num(v.w),
      t: num(v.t),
    })),
    ws: cleanObjMap(s.ws, ALL.concat(['っ']), (v) => ({ n: num(v.n), p: num(v.p) })),
    act,
    heard: cleanNum(s.heard),
    cl: cleanDates(s.cl),
    time: (() => {
      const o = {};
      if (s.time && typeof s.time === 'object')
        for (const k of Object.keys(s.time))
          if (ISO.test(k) && num(s.time[k]) > 0) o[k] = num(s.time[k]);
      return o;
    })(),
    mix: (() => {
      const o = {};
      if (s.mix && typeof s.mix === 'object')
        for (const k of Object.keys(s.mix)) {
          const [x, y] = k.split('>');
          if (LETTERS().includes(x) && LETTERS().includes(y) && num(s.mix[k]) > 0)
            o[k] = num(s.mix[k]);
        }
      return o;
    })(),
    les: (() => {
      const o = {};
      if (s.les && typeof s.les === 'object')
        for (const k of Object.keys(s.les)) {
          const v = s.les[k];
          if (/^([1-9]|1[0-9]|2[01])$/.test(k) && v && typeof v === 'object')
            o[k] = {
              m: Array.isArray(v.m) ? v.m.filter((x) => LETTERS().includes(x)) : [],
              w: Array.isArray(v.w) ? v.w.filter((x) => LETTERS().includes(x)) : [],
              q: num(v.q) || (v.q === 0 ? 0 : -1),
              r: !!v.r,
              d: Array.isArray(v.d)
                ? v.d.filter((x) => typeof x === 'string' && DAILY_ALL.some((w) => w[0] === x))
                : [],
              dd: !!v.dd,
            };
        }
      return o;
    })(),
    badges: (() => {
      const o = {};
      if (s.badges && typeof s.badges === 'object')
        for (const k of Object.keys(s.badges))
          if (/^[a-z0-9]{2,10}$/.test(k) && ISO.test(s.badges[k])) o[k] = s.badges[k];
      return o;
    })(),
    rounds: Array.isArray(s.rounds)
      ? s.rounds
          .filter((r) => r && ISO.test(r.d))
          .map((r) => ({ d: r.d, n: num(r.n), p: Math.min(100, num(r.p)) }))
          .slice(-50)
      : [],
    updated: num(s.updated),
  };
}
export function cleanStudent(p) {
  return {
    id: p.id,
    name: p.name.trim().slice(0, 24),
    color: COLORS.includes(p.color) ? p.color : COLORS[0],
    created: ISO.test(p.created) ? p.created : todayISO(),
    last: num(p.last),
    lang: supportedLocale(p.lang) ? p.lang : null,
    age: ['child', 'teen', 'adult'].includes(p.age) ? p.age : 'adult',
    native: [...localeIds(), 'ja', 'other'].includes(p.native) ? p.native : '',
    jlevel: ['new', 'some', 'all'].includes(p.jlevel) ? p.jlevel : 'new',
    rate: p.rate === 0.75 ? 0.75 : 1,
    theme: cleanTheme(p.theme),
    goal: {
      pace: [7, 14, 21].includes(p.goal && p.goal.pace) ? p.goal.pace : 14,
      min: [10, 20, 30].includes(p.goal && p.goal.min) ? p.goal.min : 30,
      reason: REASONS.includes(p.goal && p.goal.reason) ? p.goal.reason : 'jlpt',
    },
    av:
      p.av && typeof p.av === 'object'
        ? {
            t: ['initial', 'kana', 'photo'].includes(p.av.t) ? p.av.t : 'initial',
            k: typeof p.av.k === 'string' ? p.av.k : 'あ',
            img: typeof p.av.img === 'string' && p.av.img.length < 200000 ? p.av.img : '',
          }
        : { t: 'initial', k: 'あ', img: '' },
  };
}
function loadStudents() {
  try {
    const s = readStudents();
    if (s && Array.isArray(s.list)) {
      const list = s.list
        .filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim())
        .map(cleanStudent);
      return {
        v: 1,
        list,
        current: list.some((p) => p.id === s.current) ? s.current : null,
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

const progressListeners = new Set();
export function subscribeProgress(listener) {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

// Progress actions use this boundary. Persistence never imports features or emits UI effects.
export function updateProgress(change, { notify = true, timestamp = true } = {}) {
  change(state);
  if (timestamp) state.updated = Date.now();
  const student = me();
  if (student) writeProgress(student.id, state);
  if (notify) progressListeners.forEach((listener) => listener());
}

export function restoreProgress(progress, { persist = false } = {}) {
  state = normalize(progress);
  if (persist && me()) writeProgress(me().id, state);
}

export function addStudent(student, progress) {
  const record = cleanStudent(student);
  students.list.push(record);
  students.current = record.id;
  writeStudents(students);
  restoreProgress(progress, { persist: true });
  return record;
}

export function selectStudent(id) {
  const student = students.list.find((p) => p.id === id);
  if (!student) return null;
  student.last = Date.now();
  students.current = id;
  writeStudents(students);
  restoreProgress(readProgress(id));
  return student;
}

export function updateStudent(id, patch) {
  const student = students.list.find((p) => p.id === id);
  if (!student) return;
  Object.assign(student, cleanStudent({ ...student, ...patch, id }));
  writeStudents(students);
}

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

export function setDeviceLanguage(lang) {
  if (!supportedLocale(lang)) return;
  students.lang = lang;
  writeStudents(students);
}
