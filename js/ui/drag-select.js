import {moveThumb} from './thumb.js';

/* Press and drag, as on the iOS 26 tab bar and segmented controls: put a finger on one item, slide it along the bar, the
   highlight follows, and the item under the finger when it lifts is chosen. A plain tap is left alone (the browser's own
   click). When the finger has dragged, the chosen button gets a normal click() so every existing handler runs unchanged. */
const BARS = 'nav.tabs .in, .seg';
const KEYS = c => c.matches('nav.tabs .in') ? 'tabs' : c.closest('#subnav') ? 'subnav' : null;
let drag = null, swallowUntil = 0;

const items = c => Array.from(c.querySelectorAll(':scope > button')).filter(b => !b.disabled && b.offsetWidth);
const hit = (c, x) => { const bs = items(c); if (!bs.length) return null; return bs.find(b => { const r = b.getBoundingClientRect(); return x >= r.left && x <= r.right; }) || bs.reduce((a, b) => Math.abs(x - (b.getBoundingClientRect().left + b.offsetWidth / 2)) < Math.abs(x - (a.getBoundingClientRect().left + a.offsetWidth / 2)) ? b : a); };
/* show the item as chosen without choosing it yet: the highlight and the item styles read these attributes */
const show = (c, target) => items(c).forEach(b => { ['aria-selected', 'aria-pressed'].forEach(a => { if (b.hasAttribute(a)) b.setAttribute(a, b === target ? 'true' : 'false'); }); });
const restore = d => { d.saved.forEach((v, b) => Object.keys(v).forEach(a => b.setAttribute(a, v[a]))); const k = KEYS(d.c); if (k) moveThumb(d.c, k); };

document.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !e.isPrimary || drag) return;
  const b = e.target.closest && e.target.closest('button'), c = b && b.closest(BARS);
  if (!c || b.parentElement !== c || b.disabled) return;
  const saved = new Map(); items(c).forEach(x => { const v = {}; ['aria-selected', 'aria-pressed'].forEach(a => { if (x.hasAttribute(a)) v[a] = x.getAttribute(a); }); saved.set(x, v); });
  drag = {c, b, id: e.pointerId, x0: e.clientX, on: false, saved, to: b};
}, true);

document.addEventListener('pointermove', e => {
  const d = drag; if (!d || e.pointerId !== d.id) return;
  if (!d.on) {
    if (Math.abs(e.clientX - d.x0) < 8) return;
    d.on = true; d.c.classList.add('dragging');
    try { d.c.setPointerCapture(e.pointerId); } catch (x) {}
  }
  const to = hit(d.c, e.clientX); if (!to || to === d.to) return;
  d.to = to; show(d.c, to);
  const k = KEYS(d.c); if (k) moveThumb(d.c, k);
});

const end = (e, cancel) => {
  const d = drag; if (!d || e.pointerId !== d.id) return;
  drag = null; d.c.classList.remove('dragging');
  try { d.c.releasePointerCapture(e.pointerId); } catch (x) {}
  if (!d.on) return;                              /* a tap: leave it to the click */
  swallowUntil = Date.now() + 450;                /* the click that follows a drag is not another tap */
  const chosen = cancel ? null : d.to;
  restore(d);
  if (chosen && chosen.getAttribute('aria-selected') !== 'true' && chosen.getAttribute('aria-pressed') !== 'true') chosen.click();
};
document.addEventListener('pointerup', e => end(e, false), true);
document.addEventListener('pointercancel', e => end(e, true), true);
document.addEventListener('click', e => { if (Date.now() < swallowUntil && e.isTrusted) { e.stopPropagation(); e.preventDefault(); } }, true);
