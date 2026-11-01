import {goalOf} from './plan.js';
import {commit, logActivity, state} from './storage.js';
import {ALL} from '../data/letters.js';
import {t} from '../i18n/core.js';
import {todayISO} from '../util.js';

export const minutesToday = () => Math.floor(((state.time || {})[todayISO()] || 0) / 60);
export const todayText = () => t('pf.todayMin', {m: minutesToday(), g: goalOf().min});
export function weakest(n) {
  return ALL.filter(k => { const s = state.stats[k]; return s && s.w > 0; })
    .map(k => { const s = state.stats[k]; return {k, score: (s.w + 1) / (s.c + s.w + 2) + (5 - s.b) * 0.05}; })
    .sort((x, y) => y.score - x.score).slice(0, n).map(x => x.k);
}
export function rowAcc(list) { let c = 0, w = 0; list.forEach(k => { const s = state.stats[k]; if (s) { c += s.c; w += s.w; } }); return c + w ? Math.round(c / (c + w) * 100) : null; }
/* ---------- stats ---------- */
export const st = k => state.stats[k] || {b:0, c:0, w:0, t:0};
export function level(k) { const b = st(k).b || 0; return b === 0 ? 'new' : b >= 4 ? 'solid' : 'learning'; }
export function record(k, ok, ms) {
  const s = Object.assign({b:0, c:0, w:0, t:0}, state.stats[k]);
  if (ok) {
    s.c++; s.b = Math.min(5, s.b + 1);
    if (ms < 15000) s.t = s.t ? Math.round(s.t * 0.7 + ms * 0.3) : Math.round(ms);
  } else { s.w++; s.b = Math.max(1, s.b - 2); }
  state.stats[k] = s;
  logActivity();
  commit();
}
export function weight(k) { const s = state.stats[k]; if (!s) return 3; let w = 1 + (5 - (s.b || 0)) * 1.2; if (s.w > s.c) w += 2; return w; }
