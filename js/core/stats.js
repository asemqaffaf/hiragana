import { goalOf } from './plan.js';
import { state } from './store.js';
import { ALL } from '../data/letters.js';
import { t } from '../i18n/core.js';
import { addDays, todayISO } from '../util.js';

export const minutesToday = () => Math.floor(((state.time || {})[todayISO()] || 0) / 60);
export const todayText = () => t('pf.todayMin', { m: minutesToday(), g: goalOf().min });
export function weakest(n) {
  return ALL.filter((k) => {
    const s = state.stats[k];
    return s && s.w > 0;
  })
    .map((k) => {
      const s = state.stats[k];
      return { k, score: (s.w + 1) / (s.c + s.w + 2) + (5 - s.b) * 0.05 };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, n)
    .map((x) => x.k);
}
export function rowAcc(list) {
  let c = 0,
    w = 0;
  list.forEach((k) => {
    const s = state.stats[k];
    if (s) {
      c += s.c;
      w += s.w;
    }
  });
  return c + w ? Math.round((c / (c + w)) * 100) : null;
}
/* ---------- stats ---------- */
export const st = (k) => state.stats[k] || { b: 0, c: 0, w: 0, t: 0 };
export function level(k) {
  const b = st(k).b || 0;
  return b === 0 ? 'new' : b >= 4 ? 'solid' : 'learning';
}
export function streakOf(activity) {
  let day = todayISO(),
    count = 0;
  if (!(activity[day] > 0)) day = addDays(day, -1);
  while (activity[day] > 0) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}
export function weight(k) {
  const s = state.stats[k];
  if (!s) return 3;
  let w = 1 + (5 - (s.b || 0)) * 1.2;
  if (s.w > s.c) w += 2;
  return w;
}
