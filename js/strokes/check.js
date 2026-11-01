import {KVG} from '../data/kvg.js';
import {t} from '../i18n/core.js';

/* ---------- stroke checking ---------- */
const SN = 32;
const STROKE_TOL = {pos: 0.1, shape: 0.13};
export function parsePath(d) {
  const pts = [];
  let x = 0, y = 0, m;
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
function plen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
function resample(p, n) {
  const L = plen(p);
  if (p.length < 2 || L === 0) return Array.from({length: n}, () => [p[0][0], p[0][1]]);
  const out = [[p[0][0], p[0][1]]], step = L / (n - 1);
  let i = 1, a = p[0], left = step;
  while (out.length < n - 1 && i < p.length) {
    const b = p[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (seg > 0 && seg >= left) {
      const t = left / seg;
      a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(a); left = step;
    } else { left -= seg; a = b; i++; }
  }
  const last = p[p.length - 1];
  while (out.length < n) out.push([last[0], last[1]]);
  return out;
}
/* light smoothing so finger jitter does not inflate the measured length; ends stay fixed */
function smooth(p) {
  if (p.length < 5) return p;
  let q = p;
  for (let pass = 0; pass < 2; pass++) q = q.map((c, i) => (i === 0 || i === q.length - 1) ? c : [(q[i - 1][0] + c[0] + q[i + 1][0]) / 3, (q[i - 1][1] + c[1] + q[i + 1][1]) / 3]);
  return q;
}
function frechet(a, b) {
  const n = a.length, m = b.length, c = new Float64Array(n * m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const d = Math.hypot(a[i][0] - b[j][0], a[i][1] - b[j][1]);
    let v;
    if (!i && !j) v = d;
    else if (!i) v = Math.max(c[j - 1], d);
    else if (!j) v = Math.max(c[(i - 1) * m], d);
    else v = Math.max(Math.min(c[(i - 1) * m + j], c[(i - 1) * m + j - 1], c[i * m + j - 1]), d);
    c[i * m + j] = v;
  }
  return c[n * m - 1];
}
function signedArea(p) {
  /* shoelace on the closed polygon, measured from the centroid so an unclosed gap does not dominate */
  const c = centroid(p), n = p.length;
  let a = 0;
  for (let i = 0; i < n; i++) { const q = p[i], r = p[(i + 1) % n]; a += (q[0] - c[0]) * (r[1] - c[1]) - (r[0] - c[0]) * (q[1] - c[1]); }
  return a / 2;
}
function centroid(p) { let x = 0, y = 0; for (const q of p) { x += q[0]; y += q[1]; } return [x / p.length, y / p.length]; }
/* Position (where the stroke sits) and shape (stroke moved onto the template's centre) are scored separately */
function strokeFit(u, e) {
  const cu = centroid(u), ce = centroid(e), dx = ce[0] - cu[0], dy = ce[1] - cu[1];
  const a = u.map(q => [q[0] + dx, q[1] + dy]);
  let sum = 0, sumA = 0;
  for (let i = 0; i < u.length; i++) {
    sum += Math.hypot(u[i][0] - e[i][0], u[i][1] - e[i][1]);
    sumA += Math.hypot(a[i][0] - e[i][0], a[i][1] - e[i][1]);
  }
  return {avg: sum / u.length, avgA: sumA / u.length, frA: frechet(a, e), pos: Math.hypot(dx, dy), start: Math.hypot(u[0][0] - e[0][0], u[0][1] - e[0][1])};
}
export function strokeTemplates(k) {
  const d = KVG[k];
  if (!d) return null;
  const raw = d.p.map(parsePath);
  const pts = raw.map(p => resample(p, SN));
  const lens = raw.map(plen);
  /* closed loops (the ゜ circle): remember which way round they turn */
  const turn = pts.map((p, i) => { const e = p[p.length - 1]; const closed = Math.hypot(p[0][0] - e[0], p[0][1] - e[1]) < 0.25 * lens[i]; const a = signedArea(p); return closed && Math.abs(a) > 0.002 ? a : 0; });
  return {pts, lens, cents: pts.map(centroid), turn};
}
const shapeTol = (le, lenient) => Math.min(STROKE_TOL.shape, Math.max(0.04, 0.32 * le)) * lenient;
function fitPasses(f, lu, le, lenient) {
  const ts = shapeTol(le, lenient);
  return f.pos <= STROKE_TOL.pos * lenient && f.frA <= ts && f.avgA <= ts * 0.6 && lu >= 0.4 * le && lu <= 2.4 * le + 0.06;
}
/* Two templates far enough apart that drawing one where the other belongs is a real order mistake */
const apart = (tpl, i, j) => Math.hypot(tpl.cents[i][0] - tpl.cents[j][0], tpl.cents[i][1] - tpl.cents[j][1]) > 0.08;
/* Judge one drawn stroke against expected stroke i. raw: points in 0..1 square units. */
export function judgeStroke(raw, tpl, i, lenient) {
  const sm = smooth(raw), lu = plen(sm);
  if (raw.length < 2 || lu < 0.012) return {kind: 'tiny'};
  const u = resample(sm, SN);
  const fits = tpl.pts.map((e, j) => { const f = strokeFit(u, e); f.pass = fitPasses(f, lu, tpl.lens[j], lenient); return f; });
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
export const strokeCount = k => KVG[k] ? KVG[k].p.length : null;
