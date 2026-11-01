import {reduceAnim} from './motion.js';
import {DAILY_ALL} from '../data/daily.js';
import {ALL} from '../data/letters.js';
import {checkBadges} from '../features/gamify.js';
import {t} from '../i18n/core.js';
import {esc, todayISO} from '../util.js';

/* ---------- students and saving: this browser only, no server or database ---------- */
const PKEY = 'hiragana14-students-v1';
export const progKey = id => 'hiragana14-progress-' + id;
export const COLORS = ['#2A7361', '#CC3226', '#3C5A99', '#95601A', '#7A4E9C', '#4F6B2E'];
export const TINTS = ['sage', 'sand', 'sky', 'rose', 'lilac', 'slate', 'white'], MODES = ['system', 'light', 'dark'];
export const cleanTheme = x => ({mode: MODES.includes(x && x.mode) ? x.mode : 'system', tint: TINTS.includes(x && x.tint) ? x.tint : 'sage'});
export const ISO = /^\d{4}-\d{2}-\d{2}$/;
const num = v => (typeof v === 'number' && isFinite(v)) ? v : 0;
function cleanObjMap(o, keys, f) {
  const out = {};
  if (o && typeof o === 'object') for (const k of Object.keys(o)) if (keys.includes(k) && o[k] && typeof o[k] === 'object') out[k] = f(o[k]);
  return out;
}
export const LETTERS = () => ALL.concat(['ゃ', 'ゅ', 'ょ', 'っ']);
function cleanNum(o) { const out = {}; if (o && typeof o === 'object') for (const k of Object.keys(o)) if (LETTERS().includes(k) && num(o[k]) > 0) out[k] = num(o[k]); return out; }
function cleanDates(o) { const out = {}; if (o && typeof o === 'object') for (const k of Object.keys(o)) if (LETTERS().includes(k) && ISO.test(o[k])) out[k] = o[k]; return out; }
/* Shapes every saved or imported progress record, dropping anything unexpected */
export function normalize(s) {
  const f = {v:1, start:todayISO(), done:{}, stats:{}, ws:{}, act:{}, rounds:[], heard:{}, cl:{}, time:{}, mix:{}, badges:{}, les:{}, updated:0};
  if (!s || typeof s !== 'object') return f;
  const done = {}, act = {};
  if (s.done && typeof s.done === 'object') for (const k of Object.keys(s.done)) if (/^([1-9]|1[0-9]|2[01])$/.test(k) && typeof s.done[k] === 'string') done[k] = s.done[k];
  if (s.act && typeof s.act === 'object') for (const k of Object.keys(s.act)) if (ISO.test(k) && num(s.act[k]) > 0) act[k] = num(s.act[k]);
  return {
    v:1,
    start: ISO.test(s.start) ? s.start : f.start,
    done,
    stats: cleanObjMap(s.stats, ALL, v => ({b: Math.min(5, Math.max(0, num(v.b))), c: num(v.c), w: num(v.w), t: num(v.t)})),
    ws: cleanObjMap(s.ws, ALL.concat(['っ']), v => ({n: num(v.n), p: num(v.p)})),
    act,
    heard: cleanNum(s.heard), cl: cleanDates(s.cl),
    time: (() => { const o = {}; if (s.time && typeof s.time === 'object') for (const k of Object.keys(s.time)) if (ISO.test(k) && num(s.time[k]) > 0) o[k] = num(s.time[k]); return o; })(),
    mix: (() => { const o = {}; if (s.mix && typeof s.mix === 'object') for (const k of Object.keys(s.mix)) { const [x, y] = k.split('>'); if (LETTERS().includes(x) && LETTERS().includes(y) && num(s.mix[k]) > 0) o[k] = num(s.mix[k]); } return o; })(),
    les: (() => { const o = {}; if (s.les && typeof s.les === 'object') for (const k of Object.keys(s.les)) { const v = s.les[k]; if (/^([1-9]|1[0-9]|2[01])$/.test(k) && v && typeof v === 'object') o[k] = {m: Array.isArray(v.m) ? v.m.filter(x => LETTERS().includes(x)) : [], w: Array.isArray(v.w) ? v.w.filter(x => LETTERS().includes(x)) : [], q: num(v.q) || (v.q === 0 ? 0 : -1), r: !!v.r, d: Array.isArray(v.d) ? v.d.filter(x => typeof x === 'string' && DAILY_ALL.some(w => w[0] === x)) : [], dd: !!v.dd}; } return o; })(),
    badges: (() => { const o = {}; if (s.badges && typeof s.badges === 'object') for (const k of Object.keys(s.badges)) if (/^[a-z0-9]{2,10}$/.test(k) && ISO.test(s.badges[k])) o[k] = s.badges[k]; return o; })(),
    rounds: Array.isArray(s.rounds) ? s.rounds.filter(r => r && ISO.test(r.d)).map(r => ({d: r.d, n: num(r.n), p: Math.min(100, num(r.p))})).slice(-50) : [],
    updated: num(s.updated)
  };
}
function storageWorks() { try { const k = 'hiragana14-probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; } }
export const canStore = storageWorks();
export const LANGS = ['en', 'ar'];
export function cleanStudent(p) {
  return {id: p.id, name: p.name.trim().slice(0, 24), color: COLORS.includes(p.color) ? p.color : COLORS[0], created: ISO.test(p.created) ? p.created : todayISO(), last: num(p.last), lang: LANGS.includes(p.lang) ? p.lang : null,
          age: ['child', 'teen', 'adult'].includes(p.age) ? p.age : 'adult', native: ['ar', 'en', 'ja', 'other'].includes(p.native) ? p.native : '', jlevel: ['new', 'some', 'all'].includes(p.jlevel) ? p.jlevel : 'new',
          rate: p.rate === 0.75 ? 0.75 : 1, theme: cleanTheme(p.theme),
          goal: {pace: [7, 14, 21].includes(p.goal && p.goal.pace) ? p.goal.pace : 14, min: [10, 20, 30].includes(p.goal && p.goal.min) ? p.goal.min : 30, reason: ['jlpt', 'travel', 'work', 'school', 'fun'].includes(p.goal && p.goal.reason) ? p.goal.reason : 'jlpt'},
          av: p.av && typeof p.av === 'object' ? {t: ['initial', 'kana', 'photo'].includes(p.av.t) ? p.av.t : 'initial', k: typeof p.av.k === 'string' ? p.av.k : 'あ', img: typeof p.av.img === 'string' && p.av.img.length < 200000 ? p.av.img : ''} : {t: 'initial', k: 'あ', img: ''}};
}
function loadStudents() {
  try {
    const s = JSON.parse(localStorage.getItem(PKEY) || 'null');
    if (s && Array.isArray(s.list)) {
      const list = s.list.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim())
        .map(cleanStudent);
      return {v: 1, list, current: list.some(p => p.id === s.current) ? s.current : null, lang: LANGS.includes(s.lang) ? s.lang : null};
    }
  } catch (e) {}
  return {v: 1, list: [], current: null, lang: null};
}
export let students = loadStudents();
export function deviceTheme() { try { return cleanTheme(JSON.parse(localStorage.getItem('hiragana14-theme') || 'null')); } catch (e) { return cleanTheme(null); } }
/* apply a theme to the page and remember it for this device (used before anyone signs in) */
export function applyTheme(th, remember) {
  th = cleanTheme(th);
  const r = document.documentElement;
  if (themeReady && !reduceAnim()) { r.classList.add('themeanim'); clearTimeout(applyTheme.t); applyTheme.t = setTimeout(() => r.classList.remove('themeanim'), 500); }
  themeReady = true;
  if (th.mode === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', th.mode);
  if (th.tint === 'sage') r.removeAttribute('data-tint'); else r.setAttribute('data-tint', th.tint);
  if (remember) { try { localStorage.setItem('hiragana14-theme', JSON.stringify(th)); } catch (e) {} }
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', getComputedStyle(document.body).backgroundColor);
}
if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(deviceTheme())); } catch (e) {} }
export function saveStudents() { try { localStorage.setItem(PKEY, JSON.stringify(students)); } catch (e) {} }
export const me = () => students.list.find(p => p.id === students.current) || null;
export function loadProgress(id) { try { const s = localStorage.getItem(progKey(id)); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
export function saveLocal() { const p = me(); if (!p) return; try { localStorage.setItem(progKey(p.id), JSON.stringify(state)); } catch (e) {} }
export let state = normalize(null);
export function commit() { state.updated = Date.now(); saveLocal(); if (typeof checkBadges === 'function') checkBadges(false); }
export function logActivity() { const d = todayISO(); state.act = Object.assign({}, state.act, {[d]: (state.act[d] || 0) + 1}); }
export function syncText() { const p = me(); return t('sync', {name: p ? esc(p.name) : ''}); }
let themeReady = false;

export function replaceState(v) { state = v; return v; }
