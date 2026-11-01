import {$, $$} from '../util.js';

/* ---------- motion ---------- */
export const reduceAnim = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
let enterTimer = 0, firstTab = true;
export function enterAnim(name, opts, prevTab) {
  const el = $('#tab-' + name); if (!el) return;
  const first = firstTab; firstTab = false;
  if (reduceAnim() || (name === prevTab && !first && !opts.fromHistory)) return;
  el.classList.remove('enter', 'rev', 'first'); void el.offsetWidth;
  /* give map and calendar cells their wave order */
  $$('.cmap, .cal', el).forEach(g => Array.from(g.children).forEach((c, i) => c.style.setProperty('--i', Math.min(i, 40))));
  el.classList.add('enter'); if (opts.fromHistory) el.classList.add('rev'); if (first || opts.initial) el.classList.add('first');
  if (name === 'progress') countUp(el);
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => $$('.tab.enter').forEach(x => x.classList.remove('enter', 'rev', 'first')), 1900);
}
function countUp(root) {
  $$('.pstat b', root).forEach(b => {
    const m = /^(\d+)(%?)$/.exec(b.textContent.trim()); if (!m) return;
    const to = +m[1], suf = m[2], t0 = performance.now(), dur = 800;
    if (!to) return;
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.textContent = Math.round(to * e) + suf; if (k < 1) requestAnimationFrame(step); else b.textContent = to + suf; };
    b.textContent = '0' + suf; requestAnimationFrame(step);
  });
}
/* restart a one-shot animation class on an element (next question, next card) */
export function replay(el, cls) { if (!el || reduceAnim()) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
