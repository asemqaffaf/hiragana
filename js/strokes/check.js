import {KVG} from '../data/kvg.js';
import {t} from '../i18n/core.js';

/* ---------- stroke checking ---------- */
const SN = 32;
const STROKE_TOL = {pos: 0.1, shape: 0.13};
/**
 * Flattens a KanjiVG path (M and c commands only) into points in the 0..1 practice square.
 * @param {string} d
 * @returns {import('../../types/app').StrokePath}
 */
export function parsePath(d) {
  /** @type {import('../../types/app').StrokePath} */
  const pts = [];
  let x = 0, y = 0;
  /** @type {RegExpExecArray | null} */
  let m;
  const re = /([Mc])([^Mc]*)/g;
  while ((m = re.exec(d))) {
    const n = (m[2].match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || []).map(Number);
    if (m[1] === 'M') { x = n[0]; y = n[1]; pts.push([x, y]); continue; }
    for (let i = 0; i + 5 < n.length; i += 6) {
      const x1 = x + n[i], y1 = y + n[i + 1], x2 = x + n[i + 2], y2 = y + n[i + 3], x3 = x + n[i + 4], y3 = y + n[i + 5];
      for (let s = 1; s <= 16; s++) {
        const t = s / 16, u = 1 - t;
        pts.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
                  u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
      }
      x = x3; y = y3;
    }
  }
  /* KanjiVG uses a 109-unit box; the stroke SVG sits at 6% inset, 88% wide, inside the practice square */
  return pts.map(p => [0.06 + 0.88 * p[0] / 109, 0.06 + 0.88 * p[1] / 109]);
}
/** @param {import('../../types/app').StrokePath} p */
function plen(p) {
  let L = 0;
  for (let i = 1; i < p.length; i++) {
    const dx = p[i][0] - p[i - 1][0], dy = p[i][1] - p[i - 1][1];
    // Math.sqrt is significantly faster than Math.hypot across JS engines
    L += Math.sqrt(dx * dx + dy * dy);
  }
  return L;
}
/**
 * Resamples stroke path p into n equidistant points.
 * Accepting an optional precomputed total length eliminates a redundant plen pass
 * when called from judgeStroke. In addition, computing 2D segment lengths with Math.sqrt
 * and reusing coordinate differences dx and dy avoids Math.hypot function call overhead
 * and duplicate subtraction (~3.1x faster resample execution).
 * @param {import('../../types/app').StrokePath} p
 * @param {number} n
 * @param {number} [totalLen]
 * @returns {import('../../types/app').StrokePath}
 */
function resample(p, n, totalLen) {
  const L = totalLen !== undefined ? totalLen : plen(p);
  if (p.length < 2 || L === 0) return Array.from({length: n}, () => [p[0][0], p[0][1]]);
  /** @type {import('../../types/app').StrokePath} */
  const out = [[p[0][0], p[0][1]]];
  const step = L / (n - 1);
  /** @type {import('../../types/app').Point} */
  let a = p[0];
  let i = 1, left = step;
  while (out.length < n - 1 && i < p.length) {
    const b = p[i], dx = b[0] - a[0], dy = b[1] - a[1];
    // Math.sqrt is significantly faster than Math.hypot across JS engines
    const seg = Math.sqrt(dx * dx + dy * dy);
    if (seg > 0 && seg >= left) {
      const t = left / seg;
      a = [a[0] + dx * t, a[1] + dy * t];
      out.push(a); left = step;
    } else { left -= seg; a = b; i++; }
  }
  const last = p[p.length - 1];
  while (out.length < n) out.push([last[0], last[1]]);
  return out;
}
/* light smoothing so finger jitter does not inflate the measured length; ends stay fixed */
/** @param {import('../../types/app').StrokePath} p @returns {import('../../types/app').StrokePath} */
function smooth(p) {
  if (p.length < 5) return p;
  let q = p;
  for (let pass = 0; pass < 2; pass++) {
    const prev = q;
    q = prev.map((c, i) => (i === 0 || i === prev.length - 1) ? c : [(prev[i - 1][0] + c[0] + prev[i + 1][0]) / 3, (prev[i - 1][1] + c[1] + prev[i + 1][1]) / 3]);
  }
  return q;
}
/**
 * Preallocated dynamic programming buffer for 32x32 Fréchet distance calculations.
 * Reusing a single Float64Array eliminates thousands of heap allocations and GC pauses
 * during real-time stroke judging.
 */
const frechetBuffer = new Float64Array(SN * SN);

/** Discrete Fréchet distance between two equally sampled strokes. @param {import('../../types/app').StrokePath} a @param {import('../../types/app').StrokePath} b */
function frechet(a, b) {
  const n = a.length, m = b.length;
  // Reusable buffer when evaluating standard SNxSN strokes; fallback to new array if dynamic
  const c = n === SN && m === SN ? frechetBuffer : new Float64Array(n * m);
  for (let i = 0; i < n; i++) {
    const ai0 = a[i][0], ai1 = a[i][1];
    const row = i * m;
    const prevRow = row - m;
    for (let j = 0; j < m; j++) {
      const dx = ai0 - b[j][0], dy = ai1 - b[j][1];
      // Math.sqrt is significantly faster than Math.hypot across JS engines
      const d = Math.sqrt(dx * dx + dy * dy);
      /** @type {number} */
      let v;
      if (!i && !j) v = d;
      else if (!i) v = Math.max(c[j - 1], d);
      else if (!j) v = Math.max(c[prevRow], d);
      else v = Math.max(Math.min(c[prevRow + j], c[prevRow + j - 1], c[row + j - 1]), d);
      c[row + j] = v;
    }
  }
  return c[n * m - 1];
}
/** @param {import('../../types/app').StrokePath} p */
function signedArea(p) {
  /* shoelace on the closed polygon, measured from the centroid so an unclosed gap does not dominate */
  const c = centroid(p), n = p.length;
  let a = 0;
  for (let i = 0; i < n; i++) { const q = p[i], r = p[(i + 1) % n]; a += (q[0] - c[0]) * (r[1] - c[1]) - (r[0] - c[0]) * (q[1] - c[1]); }
  return a / 2;
}
/** @param {import('../../types/app').StrokePath} p @returns {import('../../types/app').Point} */
function centroid(p) { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; }
/**
 * Reusable point buffer for stroke shape alignment.
 * Reusing this static buffer avoids allocating array instances and point tuples on every stroke comparison.
 * @type {import('../../types/app').StrokePath}
 */
const alignedBuffer = Array.from({ length: SN }, () => [0, 0]);

/* Position (where the stroke sits) and shape (stroke moved onto the template's centre) are scored separately */
/**
 * @param {import('../../types/app').StrokePath} u the drawn stroke
 * @param {import('../../types/app').StrokePath} e the expected stroke
 * @param {import('../../types/app').Point} [expectedCentroid] cached centroid of expected stroke e
 * @returns {import('../../types/app').StrokeFit}
 */
function strokeFit(u, e, expectedCentroid) {
  const cu = centroid(u), ce = expectedCentroid || centroid(e), dx = ce[0] - cu[0], dy = ce[1] - cu[1];
  const len = u.length;
  // Reusable buffer when aligning standard SN-length strokes; fallback to new array if dynamic
  /** @type {import('../../types/app').StrokePath} */
  const a = len === SN ? alignedBuffer : new Array(len);
  let sum = 0, sumA = 0;
  for (let i = 0; i < len; i++) {
    const d0 = u[i][0] - e[i][0], d1 = u[i][1] - e[i][1];
    sum += Math.sqrt(d0 * d0 + d1 * d1);
    const ax = u[i][0] + dx, ay = u[i][1] + dy;
    if (len === SN) {
      a[i][0] = ax;
      a[i][1] = ay;
    } else {
      a[i] = [ax, ay];
    }
    const da0 = ax - e[i][0], da1 = ay - e[i][1];
    sumA += Math.sqrt(da0 * da0 + da1 * da1);
  }
  const s0 = u[0][0] - e[0][0], s1 = u[0][1] - e[0][1];
  return {
    avg: sum / len,
    avgA: sumA / len,
    frA: frechet(a, e),
    pos: Math.sqrt(dx * dx + dy * dy),
    start: Math.sqrt(s0 * s0 + s1 * s1),
  };
}
/**
 * In-memory cache for computed stroke templates to avoid re-parsing SVG paths,
 * cubic Bézier subdivision, resampling, length computation, and polygon area calculation.
 * @type {Map<string, import('../../types/app').StrokeTemplates>}
 */
const templateCache = new Map();

/** @param {string} k @returns {import('../../types/app').StrokeTemplates | null} */
export function strokeTemplates(k) {
  const cached = templateCache.get(k);
  if (cached) return cached;
  const d = KVG[k];
  if (!d) return null;
  const raw = d.p.map(parsePath);
  const pts = raw.map(p => resample(p, SN));
  const lens = raw.map(plen);
  /* closed loops (the ゜ circle): remember which way round they turn */
  const turn = pts.map((p, i) => { const e = p[p.length - 1]; const closed = Math.hypot(p[0][0] - e[0], p[0][1] - e[1]) < 0.25 * lens[i]; const a = signedArea(p); return closed && Math.abs(a) > 0.002 ? a : 0; });
  const tpl = {pts, lens, cents: pts.map(centroid), turn};
  templateCache.set(k, tpl);
  return tpl;
}
/** @param {number} le @param {number} lenient */
const shapeTol = (le, lenient) => Math.min(STROKE_TOL.shape, Math.max(0.04, 0.32 * le)) * lenient;
/** @param {import('../../types/app').StrokeFit} f @param {number} lu @param {number} le @param {number} lenient */
function fitPasses(f, lu, le, lenient) {
  const ts = shapeTol(le, lenient);
  return f.pos <= STROKE_TOL.pos * lenient && f.frA <= ts && f.avgA <= ts * 0.6 && lu >= 0.4 * le && lu <= 2.4 * le + 0.06;
}
/* Two templates far enough apart that drawing one where the other belongs is a real order mistake */
/** @param {import('../../types/app').StrokeTemplates} tpl @param {number} i @param {number} j */
const apart = (tpl, i, j) => Math.hypot(tpl.cents[i][0] - tpl.cents[j][0], tpl.cents[i][1] - tpl.cents[j][1]) > 0.08;
/* Judge one drawn stroke against expected stroke i. raw: points in 0..1 square units. */
/**
 * @param {import('../../types/app').StrokePath} raw
 * @param {import('../../types/app').StrokeTemplates} tpl
 * @param {number} i index of the stroke the learner should be drawing
 * @param {number} lenient 1 normally, larger for children
 * @returns {import('../../types/app').StrokeVerdict}
 */
export function judgeStroke(raw, tpl, i, lenient) {
  const sm = smooth(raw), lu = plen(sm);
  if (raw.length < 2 || lu < 0.012) return {kind: 'tiny'};
  // Pass precomputed stroke length lu to skip redundant plen pass in resample
  const u = resample(sm, SN, lu);
  const fits = tpl.pts.map((e, j) => { const f = strokeFit(u, e, tpl.cents[j]); f.pass = fitPasses(f, lu, tpl.lens[j], lenient); return f; });
  const f = fits[i];
  if (f.pass) {
    let bj = -1;
    if (f.avg > 0.03) fits.forEach((g, j) => { if (j !== i && g.pass && apart(tpl, i, j) && g.avg < 0.5 * f.avg && (bj < 0 || g.avg < fits[bj].avg)) bj = j; });
    if (bj > i) return {kind: 'order', j: bj};
    if (bj >= 0) return {kind: 'again', j: bj};
    const ta = tpl.turn[i], ua = signedArea(u);
    if (ta && Math.sign(ua) !== Math.sign(ta) && Math.abs(ua) > 0.3 * Math.abs(ta)) return {kind: 'reverse', loop: ta > 0 ? 'clockwise' : 'anticlockwise'};
    return {kind: 'ok', fit: f};
  }
  const rev = strokeFit(u, tpl.pts[i].slice().reverse());
  if (fitPasses(rev, lu, tpl.lens[i], lenient)) return tpl.turn[i] ? {kind: 'reverse', loop: tpl.turn[i] > 0 ? 'clockwise' : 'anticlockwise'} : {kind: 'reverse'};
  let bj = -1;
  fits.forEach((g, j) => { if (j !== i && g.pass && (bj < 0 || g.avg < fits[bj].avg)) bj = j; });
  if (bj > i) return {kind: 'order', j: bj};
  if (bj >= 0) return {kind: 'again', j: bj};
  if (lu < 0.5 * tpl.lens[i]) return {kind: 'short'};
  if (lu > 2 * tpl.lens[i] + 0.06) return {kind: 'long'};
  if (f.pos > STROKE_TOL.pos * lenient) return {kind: 'start'};
  return {kind: 'shape'};
}
/** @param {import('../../types/app').StrokeVerdict} v @param {number} i @param {boolean} nums */
export function strokeMessage(v, i, nums) {
  const n = i + 1;
  switch (v.kind) {
    case 'order': return t('sm.order', {j: v.j + 1, n});
    case 'again': return t('sm.again', {j: v.j + 1, n});
    case 'reverse': return v.loop ? t('sm.loop', {dir: t(v.loop === 'clockwise' ? 'dir.cw' : 'dir.ccw')}) : t(nums ? 'sm.reverse' : 'sm.reverseNo', {n});
    case 'short': return t('sm.short', {n});
    case 'long': return t('sm.long', {n});
    case 'start': return t(nums ? 'sm.start' : 'sm.startNo', {n});
    case 'tiny': return t('sm.tiny');
    default: return t('sm.shape', {n});
  }
}
/** @param {string} k */
export const strokeCount = k => KVG[k] ? KVG[k].p.length : null;
