import { isObject } from '../util.js';
import { LETTERS } from './store.js';

/** Stable text for comparing two plain values regardless of key order. @param {unknown} value */
export const canon = (value) =>
  JSON.stringify(value, (_key, x) =>
    isObject(x) && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : x,
  );

/** @template {string} K @template T
 * @param {Partial<Record<K, T>>} a @param {Partial<Record<K, T>>} b @param {(x: T, y: T) => T} pick
 * @returns {Partial<Record<K, T>>}
 */
function mergeMap(a, b, pick) {
  /** @type {Partial<Record<K, T>>} */
  const out = { ...a };
  for (const key of /** @type {K[]} */ (Object.keys(b))) {
    const x = a[key];
    const y = /** @type {T} */ (b[key]);
    out[key] = x === undefined ? y : pick(x, y);
  }
  return out;
}
/** @param {number} x @param {number} y */
const larger = (x, y) => Math.max(x, y);
/** @param {string} x @param {string} y */
const earlier = (x, y) => (x <= y ? x : y);
/** Both lists without repeats, in a fixed order so every device ends up with the same list. @param {string[]} x @param {string[]} y */
const union = (x, y) => {
  const rank = (/** @type {string} */ item) => LETTERS().indexOf(item);
  return Array.from(new Set([...x, ...y])).sort((p, q) => rank(p) - rank(q) || (p < q ? -1 : p > q ? 1 : 0));
};

/**
 * Combines two normalized progress records from different devices without losing either side's work.
 * Progress only grows (attempts, days studied, letters met), so each field keeps the larger or earlier value.
 * The result does not depend on argument order, so every device converges on the same record.
 * @param {import('../../types/app').Progress} a
 * @param {import('../../types/app').Progress} b
 * @returns {import('../../types/app').Progress}
 */
export function mergeProgress(a, b) {
  // A reset is deliberate: whatever was saved before it, on any device, is dropped rather than merged back in.
  if (a.reset !== b.reset) return a.reset > b.reset ? a : b;
  const newer = a.updated >= b.updated ? a : b;
  const les = mergeMap(a.les, b.les, (x, y) => {
    const writing = mergeMap(x.writing || {}, y.writing || {}, (p, q) => (q.completed > p.completed ? q : p));
    return {
      m: union(x.m, y.m),
      w: union(x.w, y.w),
      q: Math.max(x.q, y.q),
      r: x.r || y.r,
      d: union(x.d, y.d),
      dd: x.dd || y.dd,
      ...(Object.keys(writing).length ? { writing } : {}),
    };
  });
  // The resume marker is a pointer, not progress: keep the one from the device used most recently.
  for (const day of Object.keys(les)) {
    const marker = newer.les[day]?.writingResume || (newer === a ? b : a).les[day]?.writingResume;
    const entry = les[day];
    if (marker && entry) entry.writingResume = marker;
  }
  const rounds = [...a.rounds, ...b.rounds]
    .filter((round, i, all) => all.findIndex((other) => canon(other) === canon(round)) === i)
    .sort((x, y) => (x.d < y.d ? -1 : x.d > y.d ? 1 : 0))
    .slice(-50);
  return {
    v: 1,
    start: earlier(a.start, b.start),
    done: mergeMap(a.done, b.done, earlier),
    stats: mergeMap(a.stats, b.stats, (x, y) => {
      // More attempts means newer; a tie goes to the higher mastery step, then to a fixed order.
      const order = x.c + x.w - (y.c + y.w) || x.b - y.b || (canon(x) < canon(y) ? -1 : 1);
      return order >= 0 ? x : y;
    }),
    ws: mergeMap(a.ws, b.ws, (x, y) => ({ n: larger(x.n, y.n), p: larger(x.p, y.p) })),
    act: mergeMap(a.act, b.act, larger),
    heard: mergeMap(a.heard, b.heard, larger),
    cl: mergeMap(a.cl, b.cl, earlier),
    time: mergeMap(a.time, b.time, larger),
    mix: mergeMap(a.mix, b.mix, larger),
    les,
    badges: mergeMap(a.badges, b.badges, earlier),
    rounds,
    updated: larger(a.updated, b.updated),
    reset: a.reset,
  };
}
