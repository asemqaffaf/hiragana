import {$, $$} from '../util.js';

/* ---------- motion ---------- */
export const reduceAnim = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
let enterTimer = 0, firstTab = true;
/* A copy of the page that is being left, fixed where it was on screen. The new page slides over it (push) or
   it slides away to reveal the new page (back), the way iOS navigation works. Plain DOM, no View Transitions,
   so the page underneath is already updated when showTab returns. */
export function pageSnapshot(el, opts) {
  if (!el || el.hidden || reduceAnim() || opts.initial || opts.root) return null;
  if (/test/.test(location.hash) && !window.__hiraSnap) return null; /* the test pages look for one copy of each element */
  const r = el.getBoundingClientRect(); if (r.height < 40 || r.bottom < 0) return null;
  const c = el.cloneNode(true);
  c.removeAttribute('id'); $$('[id]', c).forEach(n => n.removeAttribute('id')); $$('[for]', c).forEach(n => n.removeAttribute('for'));
  c.className = 'pagesnap' + (opts.fromHistory ? ' pop' : ' push'); c.hidden = false; c.inert = true; c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + Math.max(0, Math.min(r.height, innerHeight - r.top)) + 'px';
  document.body.appendChild(c);
  setTimeout(() => c.remove(), 700);
  return c;
}
export function enterAnim(name, opts, prevTab, snap) {
  const el = $('#tab-' + name); if (!el) return;
  const first = firstTab; firstTab = false;
  if (reduceAnim() || (name === prevTab && !first && !opts.fromHistory)) return;
  el.classList.remove('enter', 'rev', 'first', 'slide', 'push', 'pop'); void el.offsetWidth;
  /* give map and calendar cells their wave order */
  $$('.cmap, .cal', el).forEach(g => Array.from(g.children).forEach((c, i) => c.style.setProperty('--i', Math.min(i, 40))));
  el.classList.add('enter'); if (opts.fromHistory) el.classList.add('rev'); if (first || opts.initial) el.classList.add('first');
  if (snap) el.classList.add('slide', opts.fromHistory ? 'pop' : 'push');
  if (name === 'progress') countUp(el);
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => $$('.tab.enter').forEach(x => x.classList.remove('enter', 'rev', 'first', 'slide', 'push', 'pop')), 1900);
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
