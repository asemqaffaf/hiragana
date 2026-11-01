import { me, state } from './store.js';
import { PLAN, REVIEW_EN } from '../data/content.js';
import { A46, ALL, DROWS, ROWS, YROWS, kanaOf } from '../data/letters.js';
import { LANG, localeFor, translate } from '../i18n/core.js';
import { isoToUTC, todayISO, uniq } from '../util.js';

/* ---------- plan helpers ---------- */
/** Which day of the plan today is: 1 on the start date, 0 or less before it. */
export function dayNumber() {
  return Math.floor((isoToUTC(todayISO()) - isoToUTC(state.start)) / 86400000) + 1;
}
/** @type {{key: string, plan: import('../../types/app').PlanDay[]} | null} */
let planCache = null;
/** The student's goal with defaults for anything missing. @param {import('../../types/app').Student | null} [p] @returns {import('../../types/app').Goal} */
export const goalOf = (p) =>
  Object.assign({ pace: 14, min: 30, reason: 'jlpt' }, (p || me())?.goal);
/** @param {import('../../types/app').Task | string} task @param {number} factor @param {string} language */
function formatTask(task, factor, language) {
  if (typeof task === 'string') return task;
  if (!task.minutes) return task.text;
  const minutes = Math.max(2, Math.round(task.minutes * factor));
  return task.text + ' (' + translate(language, 'duration.minutes', { n: minutes }) + ')';
}
/**
 * The 14 base days, reshaped for the student's pace and daily minutes.
 * @param {import('../../types/app').Goal} goal
 * @param {string} lang
 * @returns {import('../../types/app').PlanDay[]}
 */
function buildPlan(goal, lang) {
  const content = localeFor(lang).content;
  /** @typedef {Omit<import('../../types/app').PlanDay, 'tasks'> & {tasks: (import('../../types/app').Task | string)[]}} DraftDay */
  /** @type {DraftDay[]} */
  const base = PLAN.map((d, i) => {
    const loc = content.plan?.[i] || {};
    return {
      t: loc.t ?? d.t,
      tasks: (loc.tasks ?? d.tasks).slice(),
      f: d.f.slice(),
      pool: d.pool,
      base: [i + 1],
    };
  });
  /** @type {DraftDay[]} */
  let out;
  if (goal.pace === 7) {
    out = [];
    for (let i = 0; i < 14; i += 2) {
      const x = base[i],
        y = base[i + 1];
      out.push({
        t: x.t + ' + ' + y.t,
        tasks: x.tasks.concat(y.tasks),
        f: x.f.concat(y.f),
        pool: x.f.length || y.f.length ? undefined : y.pool || x.pool,
        base: [i + 1, i + 2],
      });
    }
  } else if (goal.pace === 21) {
    const review = { ...REVIEW_EN, ...content.review };
    /** @returns {DraftDay} */
    const rev = () => ({
      t: review.t,
      tasks: review.tasks.slice(),
      f: [],
      pool: 'sofar',
      base: [],
      review: true,
    });
    out = [];
    base.forEach((d, i) => {
      out.push(d);
      if ([2, 4, 6, 8, 10, 12, 13].includes(i + 1)) out.push(rev());
    });
  } else out = base;
  const f = (goal.min || 30) / 30;
  return out.map((d) => ({ ...d, tasks: d.tasks.map((task) => formatTask(task, f, lang)) }));
}
/** The plan for the student (or a given one), cached for the current student and language. @param {import('../../types/app').Student} [p] */
export function PL(p) {
  const g = goalOf(p),
    key = g.pace + '|' + g.min + '|' + LANG;
  if (p) return buildPlan(g, LANG);
  if (!planCache || planCache.key !== key) planCache = { key, plan: buildPlan(g, LANG) };
  return planCache.plan;
}
/** @param {import('../../types/app').Student} [p] */
export const PLEN = (p) => PL(p).length;
/* plan days that contain any of the given base days */
/** @param {number[]} bases */
export const planDaysFor = (bases) =>
  PL()
    .map((d, i) => (d.base.some((b) => bases.includes(b)) ? i + 1 : 0))
    .filter(Boolean);
export function curDay() {
  return Math.min(Math.max(dayNumber(), 1), PLEN());
}
/** The letters that are new on a plan day. @param {number} day @returns {string[]} */
export function focusKana(day) {
  const d = PL()[day - 1];
  return d.f.flatMap((id) => {
    const r =
      ROWS.find((x) => x.id === id) ||
      DROWS.find((x) => x.id === id) ||
      YROWS.find((x) => x.id === id);
    return r ? kanaOf(r) : [];
  });
}
/** @returns {string[]} */
export function todayPool() {
  const n = dayNumber();
  if (n > PLEN()) return ALL;
  const day = curDay(),
    d = PL()[day - 1];
  if (d.pool === 'sofar') return soFarPool();
  if (d.pool === 'a46') return A46;
  if (d.pool === 'all') return ALL;
  return focusKana(day);
}
/** @returns {string[]} */
export function soFarPool() {
  const day = curDay();
  /** @type {string[]} */
  let out = [];
  for (let i = 1; i <= day; i++) out = out.concat(focusKana(i));
  if (
    PL()
      .slice(0, day)
      .some((d) => d.base.some((b) => b >= 10)) ||
    dayNumber() > PLEN()
  )
    out = ALL;
  if (!out.length) out = A46.slice(0, 10);
  return uniq(out);
}
export function weakPool() {
  return ALL.filter((k) => {
    const s = state.stats[k];
    return s && s.w > 0 && (s.b <= 2 || s.w > s.c);
  });
}
