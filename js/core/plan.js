import {me, state} from './storage.js';
import {PLAN, REVIEW_EN} from '../data/content.js';
import {A46, ALL, DROWS, ROWS, YROWS} from '../data/letters.js';
import {PLAN_AR, REVIEW_AR, arMin} from '../i18n/ar-content.js';
import {LANG} from '../i18n/core.js';
import {isoToUTC, todayISO, uniq} from '../util.js';

/* ---------- plan helpers ---------- */
export function dayNumber() { return Math.floor((isoToUTC(todayISO()) - isoToUTC(state.start)) / 86400000) + 1; }
export let planCache = {key: '', plan: null};
export const goalOf = p => Object.assign({pace: 14, min: 30, reason: 'jlpt'}, (p || me() || {}).goal);
function scaleTask(s, f) {
  if (f === 1) return s;
  return s.replace(/\((\d+) min\)/, (m, n) => '(' + Math.max(2, Math.round(+n * f)) + ' min)')
          .replace(/\((\d+) (دقائق|دقيقة)\)/, (m, n) => '(' + arMin(Math.max(2, Math.round(+n * f))) + ')');
}
/* The 14 base days, reshaped for the student's pace and daily minutes */
function buildPlan(goal, lang) {
  const base = PLAN.map((d, i) => { const loc = lang === 'ar' ? PLAN_AR[i] : d; return {t: loc.t, tasks: loc.tasks.slice(), f: d.f.slice(), pool: d.pool, base: [i + 1]}; });
  let out;
  if (goal.pace === 7) {
    out = [];
    for (let i = 0; i < 14; i += 2) { const x = base[i], y = base[i + 1]; out.push({t: x.t + ' + ' + y.t, tasks: x.tasks.concat(y.tasks), f: x.f.concat(y.f), pool: x.f.length || y.f.length ? undefined : (y.pool || x.pool), base: [i + 1, i + 2]}); }
  } else if (goal.pace === 21) {
    const rev = () => ({t: lang === 'ar' ? REVIEW_AR.t : REVIEW_EN.t, tasks: (lang === 'ar' ? REVIEW_AR : REVIEW_EN).tasks.slice(), f: [], pool: 'sofar', base: [], review: true});
    out = [];
    base.forEach((d, i) => { out.push(d); if ([2, 4, 6, 8, 10, 12, 13].includes(i + 1)) out.push(rev()); });
  } else out = base;
  const f = (goal.min || 30) / 30;
  out.forEach(d => { d.tasks = d.tasks.map(s => scaleTask(s, f)); });
  return out;
}
export function PL(p) {
  const g = goalOf(p), key = g.pace + '|' + g.min + '|' + LANG;
  if (p) return buildPlan(g, LANG);
  if (planCache.key !== key) planCache = {key, plan: buildPlan(g, LANG)};
  return planCache.plan;
}
export const PLEN = p => PL(p).length;
/* plan days that contain any of the given base days */
export const planDaysFor = bases => PL().map((d, i) => d.base.some(b => bases.includes(b)) ? i + 1 : 0).filter(Boolean);
export function curDay() { return Math.min(Math.max(dayNumber(), 1), PLEN()); }
export function focusKana(day) {
  const d = PL()[day - 1];
  return d.f.flatMap(id => {
    const r = ROWS.find(x => x.id === id) || DROWS.find(x => x.id === id) || YROWS.find(x => x.id === id);
    return r ? r.kana.filter(Boolean) : [];
  });
}
export function todayPool() {
  const n = dayNumber();
  if (n > PLEN()) return ALL;
  const day = curDay(), d = PL()[day - 1];
  if (d.pool === 'sofar') return soFarPool();
  if (d.pool === 'a46') return A46;
  if (d.pool === 'all') return ALL;
  return focusKana(day);
}
export function soFarPool() { const day = curDay(); let out = []; for (let i = 1; i <= day; i++) out = out.concat(focusKana(i)); if (PL().slice(0, day).some(d => d.base.some(b => b >= 10)) || dayNumber() > PLEN()) out = ALL; if (!out.length) out = A46.slice(0, 10); return uniq(out); }
export function weakPool() { return ALL.filter(k => { const s = state.stats[k]; return s && s.w > 0 && (s.b <= 2 || s.w > s.c); }); }
