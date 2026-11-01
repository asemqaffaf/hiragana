import {KVG} from '../data/kvg.js';
import {reduceMotion} from '../util.js';

/* ---------- stroke order ---------- */
const wait = ms => new Promise(r => setTimeout(r, ms));
/* Animate one SVG path from its start to its end. msPerUnit scales duration with stroke length.
   Resolves false if cancelled (live() turned false), true when the stroke is fully drawn. */
function drawPath(p, msPerUnit, live) {
  let L = 0;
  try { L = p.getTotalLength(); } catch (e) { L = 0; }
  if (!L) { p.style.visibility = 'visible'; return Promise.resolve(true); }
  const dur = Math.max(msPerUnit ? 420 : 320, L * (msPerUnit || 11));
  p.setAttribute('stroke-dasharray', L + ' ' + L);
  p.setAttribute('stroke-dashoffset', L);
  p.style.visibility = 'visible';
  return new Promise(resolve => {
    const t0 = performance.now();
    function step(now) {
      if (!live()) { resolve(false); return; }
      const t = Math.min(1, (now - t0) / dur), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      p.setAttribute('stroke-dashoffset', (L * (1 - e)).toFixed(2));
      if (t < 1) requestAnimationFrame(step);
      else { p.removeAttribute('stroke-dasharray'); p.removeAttribute('stroke-dashoffset'); resolve(true); }
    }
    requestAnimationFrame(step);
  });
}
export function strokeSVG(k, opts) {
  opts = opts || {};
  const d = KVG[k];
  if (!d) return null;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 109 109');
  svg.setAttribute('class', 'strokes' + (opts.guide === false ? ' no-guide' : '') + (opts.nums === false ? ' no-num' : ''));
  svg.setAttribute('aria-hidden', 'true');
  const mk = (tag, cls) => { const e = document.createElementNS(ns, tag); if (cls) e.setAttribute('class', cls); return e; };
  const gd = mk('g', 'gd'), ik = mk('g', 'ik'), ht = mk('g', 'ht'), nm = mk('g', 'nm');
  d.p.forEach(p => {
    const a = mk('path'); a.setAttribute('d', p); gd.appendChild(a);
    const b = mk('path'); b.setAttribute('d', p); ik.appendChild(b);
    const c = mk('path'); c.setAttribute('d', p); c.style.visibility = 'hidden'; ht.appendChild(c);
  });
  const dot = mk('circle'); dot.setAttribute('r', '3.4'); dot.style.visibility = 'hidden'; ht.appendChild(dot);
  d.n.forEach((xy, i) => {
    const t = mk('text');
    t.setAttribute('x', xy[0]); t.setAttribute('y', xy[1]); t.textContent = i + 1; nm.appendChild(t);
  });
  svg.appendChild(gd); svg.appendChild(ik); svg.appendChild(ht); svg.appendChild(nm);
  if (opts.inkHidden) ik.style.visibility = 'hidden';
  const inkPaths = () => Array.from(ik.children);
  const hintPaths = () => Array.from(ht.querySelectorAll('path'));
  const clearDash = p => { p.removeAttribute('stroke-dasharray'); p.removeAttribute('stroke-dashoffset'); p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; };
  function resetInk() { inkPaths().forEach(p => { clearDash(p); p.style.visibility = ''; }); }
  let token = 0, htok = 0;
  /* Stroke order demo. Frame-by-frame dash animation, so it does not depend on the Web Animations API.
     With Reduce Motion on, strokes still appear one at a time, in order, without the drawing movement. */
  svg.play = async function () {
    const my = ++token, live = () => my === token;
    svg.clearHint();
    ik.style.visibility = 'visible';
    const paths = inkPaths();
    paths.forEach(p => { clearDash(p); p.style.visibility = 'hidden'; });
    await wait(reduceMotion ? 250 : 120);
    for (const p of paths) {
      if (!live()) return;
      if (reduceMotion) { p.style.visibility = 'visible'; await wait(650); continue; }
      const ok = await drawPath(p, null, live);
      if (!ok) return;
      await wait(160);
    }
  };
  svg.showInk = function (on) { token++; resetInk(); ik.style.visibility = on ? 'visible' : 'hidden'; };
  /* show only the strokes the learner has already drawn correctly */
  svg.showUpTo = function (n) { token++; resetInk(); ik.style.visibility = 'visible'; inkPaths().forEach((p, i) => { p.style.visibility = i < n ? 'visible' : 'hidden'; }); };
  svg.clearHint = function () {
    htok++;
    hintPaths().forEach(p => { clearDash(p); p.style.visibility = 'hidden'; });
    dot.style.visibility = 'hidden'; ht.style.transition = ''; ht.style.opacity = '';
  };
  /* draw stroke i in red, with a dot where it starts, then fade it out */
  svg.hint = async function (i) {
    svg.clearHint();
    const my = htok, live = () => my === htok, p = hintPaths()[i];
    if (!p) return;
    const m = /M\s*(-?[\d.]+)[,\s]+(-?[\d.]+)/.exec(d.p[i]);
    if (m) { dot.setAttribute('cx', m[1]); dot.setAttribute('cy', m[2]); dot.style.visibility = 'visible'; }
    if (reduceMotion) p.style.visibility = 'visible';
    else if (!(await drawPath(p, 14, live))) return;
    await wait(1300);
    if (!live()) return;
    ht.style.transition = 'opacity .4s'; ht.style.opacity = '0';
    await wait(450);
    if (live()) svg.clearHint();
  };
  return svg;
}
