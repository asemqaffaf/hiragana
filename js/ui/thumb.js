import {reduceAnim} from '../core/motion.js';
import {$, $$} from '../util.js';

/* The moving highlight behind the selected tab (tab bar) or segment (segmented control), as in iOS 26: one shape that glides, with a spring,
   from the old position to the new one. The control's own selected style is dropped while the thumb is there (.has-thumb). */
const last = new Map();
const place = (th, p) => { th.style.width = p.w + 'px'; th.style.transform = 'translateX(' + p.x + 'px)'; };
export function moveThumb(c, key, instant) {
  if (!c) return;
  let th = $(':scope > .thumb', c);
  if (!th) { th = document.createElement('i'); th.className = 'thumb'; th.setAttribute('aria-hidden', 'true'); c.prepend(th); }
  c.classList.add('has-thumb');
  const sel = $('[aria-selected="true"], [aria-pressed="true"]', c);
  if (!sel || !sel.offsetWidth) { th.style.opacity = '0'; return; }   /* the bar is hidden (signed out) */
  th.style.opacity = '';
  const to = {x: sel.offsetLeft, w: sel.offsetWidth}, from = last.get(key);
  last.set(key, to);
  const jump = instant || reduceAnim() || !from;
  if (jump) th.style.transition = 'none';
  else if (!th.dataset.placed) { /* a control that was just built: start where the thumb was */ th.style.transition = 'none'; place(th, from); void th.offsetWidth; th.style.transition = ''; }
  th.dataset.placed = '1';
  place(th, to);
  if (jump) { void th.offsetWidth; th.style.transition = ''; }
}
export function resetThumbs() { $$('.has-thumb').forEach(c => { const th = $(':scope > .thumb', c); if (th) delete th.dataset.placed; }); }
