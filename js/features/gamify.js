import { PLEN } from '../core/plan.js';
import { level, todayText } from '../core/stats.js';
import { me, state } from '../core/store.js';
import { awardBadges, recordStudyTime } from '../core/progress.js';
import { ui } from '../core/ui-state.js';
import { A46, DAK25, ROWS, YOON33, kanaOf } from '../data/letters.js';
import { t } from '../i18n/core.js';
import { $, addDays, valuesOf } from '../util.js';

/** @type {readonly import('../../types/app').TextKey[]} */
const LEVEL_KEYS = ['lvl.1', 'lvl.2', 'lvl.3', 'lvl.4', 'lvl.5', 'lvl.6', 'lvl.7', 'lvl.8', 'lvl.9', 'lvl.10'];
const LEVEL_KANJI = ['芽', '葉', '苗', '若', '木', '林', '森', '山', '頂', '師'];
/** @type {import('../../types/app').Badge[]} */
export const BADGES = [
  { id: 'first', k: '初', ok: (c) => c.ans >= 1 },
  { id: 'hear', k: '聴', ok: (c) => c.heard >= 50 },
  { id: 'clean', k: '書', ok: (c) => c.clean >= 1 },
  { id: 'comp5', k: '完', ok: (c) => c.nCl >= 5 },
  { id: 'row', k: '行', ok: (c) => c.rowDone },
  { id: 'comp46', k: '全', ok: (c) => c.clA46 >= 46 },
  { id: 'str3', k: '三', ok: (c) => c.longest >= 3 },
  { id: 'str7', k: '七', ok: (c) => c.longest >= 7 },
  { id: 'r90', k: '九', ok: (c) => c.r90 },
  { id: 'r100', k: '満', ok: (c) => c.r100 },
  { id: 'solid46', k: '固', ok: (c) => c.sA46 >= 46 },
  { id: 'dak', k: '濁', ok: (c) => c.sDak >= 25 },
  { id: 'yoon', k: '拗', ok: (c) => c.sYoon >= 33 },
  { id: 'plan', k: '終', ok: (c) => c.planDone },
];
/** @param {import('../../types/app').Progress['act']} act */
function longestStreak(act) {
  const ds = Object.keys(act)
    .filter((d) => (act[d] ?? 0) > 0)
    .sort();
  let best = 0,
    run = 0;
  /** @type {string | null} */
  let prev = null;
  ds.forEach((d) => {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  });
  return best;
}
/** @returns {import('../../types/app').ProgressContext} */
export function progressCtx() {
  /** @param {string[]} list */
  const solid = (list) => list.filter((k) => level(k) === 'solid').length;
  let ans = 0,
    clean = 0,
    writes = 0,
    heard = 0;
  valuesOf(state.stats).forEach((s) => {
    ans += s.c + s.w;
  });
  valuesOf(state.ws).forEach((w) => {
    writes += w.n;
    clean += w.p;
  });
  valuesOf(state.heard).forEach((n) => {
    heard += n;
  });
  const cl = state.cl || {},
    L = PLEN();
  return {
    ans,
    clean,
    writes,
    heard,
    nCl: Object.keys(cl).length,
    clA46: A46.filter((k) => cl[k]).length,
    rowDone: ROWS.some((r) => kanaOf(r).every((k) => cl[k])),
    longest: longestStreak(state.act),
    r90: (state.rounds || []).some((r) => r.n >= 10 && r.p >= 90),
    r100: (state.rounds || []).some((r) => r.n >= 10 && r.p >= 100),
    sA46: solid(A46),
    sDak: solid(DAK25),
    sYoon: solid(YOON33),
    planDone: Array.from({ length: L }, (_, i) => i + 1).every((d) => state.done[d]),
  };
}
/** @param {import('../../types/app').ProgressContext} c */
export function xpOf(c) {
  let correct = 0;
  valuesOf(state.stats).forEach((s) => {
    correct += s.c;
  });
  const good = (state.rounds || []).filter((r) => r.n >= 10 && r.p >= 90).length;
  return (
    correct * 2 +
    c.writes * 3 +
    c.clean * 7 +
    c.nCl * 20 +
    Object.keys(state.done).length * 30 +
    good * 15
  );
}
/** @param {number} xp */
export function levelOf(xp) {
  let n = 1;
  while (n < 10 && xp >= 25 * n * (n + 1)) n++;
  return { n, from: 25 * (n - 1) * n, to: n < 10 ? 25 * n * (n + 1) : null };
}
/** @param {number} n a level, 1 to 10 */
export const levelName = (n) => LEVEL_KANJI[n - 1] + ' ' + t(LEVEL_KEYS[n - 1]);
/** Awards badges that were earned and announces them. @param {boolean} silent */
export function checkBadges(silent) {
  if (!me()) return;
  const c = progressCtx();
  const fresh = BADGES.filter((b) => !state.badges[b.id] && b.ok(c));
  const lv = levelOf(xpOf(c)).n;
  awardBadges(fresh.map((b) => b.id));
  if (!silent) {
    fresh.forEach((b, i) =>
      setTimeout(() => toast(b.k, t('toast.badge', { name: t(`b.${b.id}`) })), i * 1800),
    );
    if (ui.lastLevel && lv > ui.lastLevel)
      setTimeout(
        () => toast(LEVEL_KANJI[lv - 1], t('toast.level', { name: levelName(lv) })),
        fresh.length * 1800,
      );
  }
  ui.lastLevel = lv;
}
/** @type {ReturnType<typeof setTimeout> | undefined} */
let toastT;
/** @param {string} mark @param {string} text */
function toast(mark, text) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.innerHTML = '<span class="tk">' + mark + '</span><span></span>';
  if (el.lastChild) el.lastChild.textContent = text;
  el.className = 'show';
  clearTimeout(toastT);
  toastT = setTimeout(() => {
    el.className = '';
  }, 3600);
}
/* minutes studied: counted in 15 s steps while the page is visible and the student touched it in the last 90 s */
let lastInput = 0;
export function initTracking() {
  const mark = () => {
    lastInput = Date.now();
  };
  document.addEventListener('pointerdown', mark, true);
  document.addEventListener('keydown', mark, true);
  setInterval(() => {
    if (
      !me() ||
      document.body.classList.contains('signed-out') ||
      document.visibilityState !== 'visible' ||
      Date.now() - lastInput > 90000
    )
      return;
    recordStudyTime(15);
    if (ui.currentTab === 'profile') {
      const el = $('#todayMin');
      if (el) el.textContent = todayText();
    }
  }, 15000);
}
