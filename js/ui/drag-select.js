import {reduceAnim} from '../core/motion.js';
import {createLens} from './lens.js';
import {moveThumb} from './thumb.js';

/* Press and drag, as on the iOS 26 tab bar and segmented controls. Put a finger on the bar and the glass lifts: it grows, brightens
   and follows the finger exactly (pulling against the ends of the bar), stretching a little with the speed of the drag. The item
   it is over takes the selected look as it passes. On release the glass springs onto the nearest item and that item is chosen.
   A plain tap is left alone (the browser's own click). After a drag the chosen button gets a normal click(), so every existing
   handler runs unchanged. */
const LIFT = 1.13;
const BARS = 'nav.tabs .in, .seg';
const KEYS = c => c.matches('nav.tabs .in') ? 'tabs' : c.closest('#subnav') ? 'subnav' : null;
let drag = null, swallow = null;

const items = c => Array.from(c.querySelectorAll(':scope > button')).filter(b => !b.disabled && b.offsetWidth);
const hit = (c, x) => { const bs = items(c); if (!bs.length) return null; return bs.find(b => { const r = b.getBoundingClientRect(); return x >= r.left && x <= r.right; }) || bs.reduce((a, b) => Math.abs(x - (b.getBoundingClientRect().left + b.offsetWidth / 2)) < Math.abs(x - (a.getBoundingClientRect().left + a.offsetWidth / 2)) ? b : a); };
const thumbOf = c => c.querySelector(':scope > .thumb');
/* show the item as chosen without choosing it yet: the item styles read these attributes */
const show = (c, target) => items(c).forEach(b => { ['aria-selected', 'aria-pressed'].forEach(a => { if (b.hasAttribute(a)) b.setAttribute(a, b === target ? 'true' : 'false'); }); });
const restore = d => { d.saved.forEach((v, b) => Object.keys(v).forEach(a => b.setAttribute(a, v[a]))); const k = KEYS(d.c); if (k) moveThumb(d.c, k); };
const follow = (d, e) => {
  const th = d.th; if (!th) return;
  const r = d.c.getBoundingClientRect(), k = r.width / (d.c.offsetWidth || 1), w = th.offsetWidth, max = d.c.offsetWidth - w;
  let x = (e.clientX - r.left) / k - w / 2;
  if (x < 0) x *= .35; else if (x > max) x = max + (x - max) * .35;       /* pulls against the ends of the bar */
  th.style.transform = 'translateX(' + x + 'px)';
  const now = performance.now(), v = (e.clientX - d.lx) / Math.max(1, now - d.lt); d.lx = e.clientX; d.lt = now; d.v = d.v * .6 + v * .4;
  const st = Math.min(Math.abs(d.v) * .09, .16);                          /* faster drag, longer and flatter glass */
  th.style.scale = (LIFT + st) + ' ' + (LIFT - st * .5);
  clearTimeout(d.relax); d.relax = setTimeout(() => { th.style.scale = LIFT + ' ' + LIFT; }, 90);
};

document.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !e.isPrimary || drag) return;
  const b = e.target.closest && e.target.closest('button'), c = b && b.closest(BARS);
  if (!c || b.parentElement !== c || b.disabled) return;
  /* the tab bar: the lens (lens.js) follows the finger from the first touch; a tap is the same gesture, only shorter */
  if (c.matches('nav.tabs .in') && !reduceAnim()) {
    /* the lens only comes up when the finger slides or stays down (as on iOS), so quick taps in a row cost nothing extra */
    const d = drag = {c, id: e.pointerId, lens: null, tab: true, x0: e.clientX, x: e.clientX};
    d.timer = setTimeout(() => { if (drag === d && !d.lens) d.lens = createLens(c, d.x); }, 130);
    return;
  }
  const saved = new Map(); items(c).forEach(x => { const v = {}; ['aria-selected', 'aria-pressed'].forEach(a => { if (x.hasAttribute(a)) v[a] = x.getAttribute(a); }); saved.set(x, v); });
  drag = {c, b, id: e.pointerId, x0: e.clientX, lx: e.clientX, lt: performance.now(), v: 0, on: false, saved, to: b, th: thumbOf(c)};
}, true);

document.addEventListener('pointermove', e => {
  const d = drag; if (!d || e.pointerId !== d.id) return;
  if (d.tab) { d.x = e.clientX; if (!d.lens && Math.abs(e.clientX - d.x0) >= 6) d.lens = createLens(d.c, e.clientX); if (d.lens) d.lens.move(e.clientX); return; }
  if (!d.on) {
    if (Math.abs(e.clientX - d.x0) < 8) return;
    d.on = true; d.c.classList.add('dragging');
    try { d.c.setPointerCapture(e.pointerId); } catch (x) {}
    if (d.th) {                                   /* the glass lifts and slides to the finger, then tracks it with no delay */
      d.th.style.transition = 'transform .16s var(--slide), scale .3s var(--spring), background-color .25s, box-shadow .25s';
      d.th.style.scale = LIFT + ' ' + LIFT;
      setTimeout(() => { if (drag === d) d.th.style.transition = 'scale .2s var(--slide), background-color .25s, box-shadow .25s'; }, 170);
    }
  }
  follow(d, e);
  const to = hit(d.c, e.clientX); if (!to || to === d.to) return;
  d.to = to; show(d.c, to);
});

const end = (e, cancel) => {
  const d = drag; if (!d || e.pointerId !== d.id) return;
  if (d.tab) {
    drag = null; clearTimeout(d.timer);
    if (!d.lens) return;                                       /* a quick tap: the browser's click does the rest */
    const chosen = d.lens.release(e.clientX, cancel);
    /* a tap is left to the browser's own click (nothing is swallowed, so quick taps in a row all count);
       after a drag the chosen tab gets the click, since the browser's click then lands on the bar itself */
    if (chosen && Math.abs(e.clientX - d.x0) >= 8 && chosen.getAttribute('aria-selected') !== 'true') chosen.click();
    return;
  }
  drag = null; d.c.classList.remove('dragging'); clearTimeout(d.relax);
  try { d.c.releasePointerCapture(e.pointerId); } catch (x) {}
  if (d.th) { d.th.style.transition = ''; d.th.style.scale = ''; }      /* back to the springs in the stylesheet */
  if (!d.on) return;                              /* a tap: leave it to the click */
  swallow = {c: d.c, until: Date.now() + 450};    /* the click that follows a drag is not another tap */
  const chosen = cancel ? null : d.to;
  restore(d);
  if (chosen && chosen.getAttribute('aria-selected') !== 'true' && chosen.getAttribute('aria-pressed') !== 'true') chosen.click();
};
document.addEventListener('pointerup', e => end(e, false), true);
document.addEventListener('pointercancel', e => end(e, true), true);
document.addEventListener('click', e => { if (swallow && Date.now() < swallow.until && e.isTrusted && swallow.c.contains(e.target)) { e.stopPropagation(); e.preventDefault(); } }, true);
