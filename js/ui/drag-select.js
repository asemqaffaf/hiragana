import { reduceAnim } from '../core/motion.js';
import { createLens } from './lens.js';
import { moveThumb } from './thumb.js';

/* Press and drag, as on the iOS 26 tab bar and segmented controls. Put a finger on the bar and the glass lifts: it grows, brightens
   and follows the finger exactly (pulling against the ends of the bar), stretching a little with the speed of the drag. The item
   it is over takes the selected look as it passes. On release the glass springs onto the nearest item and that item is chosen.
   A plain tap is left alone (the browser's own click). After a drag the chosen button gets a normal click(), so every existing
   handler runs unchanged. */
const LIFT = 1.13;
const BARS = 'nav.tabs .in, .seg';
const SELECTION_ATTRS = ['aria-selected', 'aria-pressed'];

/**
 * A press on the tab bar, which the lens (lens.js) follows.
 * @typedef {object} TabDrag
 * @property {'tab'} kind
 * @property {HTMLElement} c the bar
 * @property {number} id pointer id
 * @property {number} x0 where the press started
 * @property {number} x the latest pointer position
 * @property {import('./lens.js').Lens | null} lens
 * @property {ReturnType<typeof setTimeout>} [timer]
 */
/**
 * A press on a segmented control, where the thumb follows the finger.
 * @typedef {object} BarDrag
 * @property {'bar'} kind
 * @property {HTMLElement} c the control
 * @property {number} id pointer id
 * @property {number} x0 where the press started
 * @property {number} lx previous pointer position, for the speed
 * @property {number} lt previous pointer time
 * @property {number} v smoothed speed in px/ms
 * @property {boolean} on the press has become a drag
 * @property {Map<HTMLButtonElement, Record<string, string>>} saved the selection to restore
 * @property {HTMLButtonElement} to the item under the finger
 * @property {HTMLElement | null} th the glass thumb
 * @property {ReturnType<typeof setTimeout>} [relax]
 */
/** @type {TabDrag | BarDrag | null} */
let drag = null;
/** @type {{c: HTMLElement, until: number} | null} */
let swallow = null;

/** The thumb key for a bar. @param {Element} c @returns {'tabs' | 'subnav' | null} */
const keyOf = (c) => (c.matches('nav.tabs .in') ? 'tabs' : c.closest('#subnav') ? 'subnav' : null);
/** @param {HTMLElement} c @returns {HTMLButtonElement[]} */
const items = (c) =>
  /** @type {HTMLButtonElement[]} */ (Array.from(c.querySelectorAll(':scope > button'))).filter(
    (b) => !b.disabled && b.offsetWidth,
  );
/** @param {HTMLElement} c @param {number} x */
const hit = (c, x) => {
  const bs = items(c);
  if (!bs.length) return null;
  return (
    bs.find((b) => {
      const r = b.getBoundingClientRect();
      return x >= r.left && x <= r.right;
    }) ||
    bs.reduce((a, b) =>
      Math.abs(x - (b.getBoundingClientRect().left + b.offsetWidth / 2)) <
      Math.abs(x - (a.getBoundingClientRect().left + a.offsetWidth / 2))
        ? b
        : a,
    )
  );
};
/** @param {HTMLElement} c @returns {HTMLElement | null} */
const thumbOf = (c) => c.querySelector(':scope > .thumb');
/* show the item as chosen without choosing it yet: the item styles read these attributes */
/** @param {HTMLElement} c @param {HTMLButtonElement} target */
const show = (c, target) =>
  items(c).forEach((b) =>
    SELECTION_ATTRS.forEach((a) => {
      if (b.hasAttribute(a)) b.setAttribute(a, b === target ? 'true' : 'false');
    }),
  );
/** @param {BarDrag} d */
const restore = (d) => {
  d.saved.forEach((attrs, b) => Object.keys(attrs).forEach((a) => b.setAttribute(a, attrs[a])));
  const k = keyOf(d.c);
  if (k) moveThumb(d.c, k);
};
/** @param {BarDrag} d @param {PointerEvent} e */
const follow = (d, e) => {
  const th = d.th;
  if (!th) return;
  const r = d.c.getBoundingClientRect(),
    k = r.width / (d.c.offsetWidth || 1),
    w = th.offsetWidth,
    max = d.c.offsetWidth - w;
  let x = (e.clientX - r.left) / k - w / 2;
  if (x < 0) x *= 0.35;
  else if (x > max) x = max + (x - max) * 0.35; /* pulls against the ends of the bar */
  th.style.transform = 'translateX(' + x + 'px)';
  const now = performance.now(),
    v = (e.clientX - d.lx) / Math.max(1, now - d.lt);
  d.lx = e.clientX;
  d.lt = now;
  d.v = d.v * 0.6 + v * 0.4;
  const st = Math.min(Math.abs(d.v) * 0.09, 0.16); /* faster drag, longer and flatter glass */
  th.style.scale = LIFT + st + ' ' + (LIFT - st * 0.5);
  clearTimeout(d.relax);
  d.relax = setTimeout(() => {
    th.style.scale = LIFT + ' ' + LIFT;
  }, 90);
};

document.addEventListener(
  'pointerdown',
  (e) => {
    if (e.button !== 0 || !e.isPrimary || drag) return;
    const target = e.target instanceof Element ? e.target : null;
    const b = /** @type {HTMLButtonElement | null} */ (target && target.closest('button'));
    const c = b && /** @type {HTMLElement | null} */ (b.closest(BARS));
    if (!b || !c || b.parentElement !== c || b.disabled) return;
    /* the tab bar: the lens (lens.js) follows the finger from the first touch; a tap is the same gesture, only shorter */
    if (c.matches('nav.tabs .in') && !reduceAnim()) {
      /* the lens only comes up when the finger slides or stays down (as on iOS), so quick taps in a row cost nothing extra */
      /** @type {TabDrag} */
      const d = (drag = { kind: 'tab', c, id: e.pointerId, lens: null, x0: e.clientX, x: e.clientX });
      d.timer = setTimeout(() => {
        if (drag === d && !d.lens) d.lens = createLens(c, d.x);
      }, 130);
      return;
    }
    /** @type {Map<HTMLButtonElement, Record<string, string>>} */
    const saved = new Map();
    items(c).forEach((x) => {
      /** @type {Record<string, string>} */
      const v = {};
      SELECTION_ATTRS.forEach((a) => {
        const value = x.getAttribute(a);
        if (value !== null) v[a] = value;
      });
      saved.set(x, v);
    });
    drag = {
      kind: 'bar',
      c,
      id: e.pointerId,
      x0: e.clientX,
      lx: e.clientX,
      lt: performance.now(),
      v: 0,
      on: false,
      saved,
      to: b,
      th: thumbOf(c),
    };
  },
  true,
);

document.addEventListener('pointermove', (e) => {
  const d = drag;
  if (!d || e.pointerId !== d.id) return;
  if (d.kind === 'tab') {
    d.x = e.clientX;
    if (!d.lens && Math.abs(e.clientX - d.x0) >= 6) d.lens = createLens(d.c, e.clientX);
    if (d.lens) d.lens.move(e.clientX);
    return;
  }
  if (!d.on) {
    if (Math.abs(e.clientX - d.x0) < 8) return;
    d.on = true;
    d.c.classList.add('dragging');
    try {
      d.c.setPointerCapture(e.pointerId);
    } catch (x) {}
    const th = d.th;
    if (th) {
      /* the glass lifts and slides to the finger, then tracks it with no delay */
      th.style.transition =
        'transform .16s var(--slide), scale .3s var(--spring), background-color .25s, box-shadow .25s';
      th.style.scale = LIFT + ' ' + LIFT;
      setTimeout(() => {
        if (drag === d) th.style.transition = 'scale .2s var(--slide), background-color .25s, box-shadow .25s';
      }, 170);
    }
  }
  follow(d, e);
  const to = hit(d.c, e.clientX);
  if (!to || to === d.to) return;
  d.to = to;
  show(d.c, to);
});

/** @param {PointerEvent} e @param {boolean} cancel */
const end = (e, cancel) => {
  const d = drag;
  if (!d || e.pointerId !== d.id) return;
  if (d.kind === 'tab') {
    drag = null;
    clearTimeout(d.timer);
    if (!d.lens) return; /* a quick tap: the browser's click does the rest */
    const chosen = d.lens.release(e.clientX, cancel);
    /* a tap is left to the browser's own click (nothing is swallowed, so quick taps in a row all count);
       after a drag the chosen tab gets the click, since the browser's click then lands on the bar itself */
    if (chosen && Math.abs(e.clientX - d.x0) >= 8 && chosen.getAttribute('aria-selected') !== 'true')
      chosen.click();
    return;
  }
  drag = null;
  d.c.classList.remove('dragging');
  clearTimeout(d.relax);
  try {
    d.c.releasePointerCapture(e.pointerId);
  } catch (x) {}
  if (d.th) {
    d.th.style.transition = '';
    d.th.style.scale = '';
  } /* back to the springs in the stylesheet */
  if (!d.on) return; /* a tap: leave it to the click */
  swallow = { c: d.c, until: Date.now() + 450 }; /* the click that follows a drag is not another tap */
  const chosen = cancel ? null : d.to;
  restore(d);
  if (
    chosen &&
    chosen.getAttribute('aria-selected') !== 'true' &&
    chosen.getAttribute('aria-pressed') !== 'true'
  )
    chosen.click();
};
/* belt and braces for iOS: while a finger is on the tab bar, nothing under it scrolls */
document.addEventListener(
  'touchmove',
  (e) => {
    if (drag && drag.kind === 'tab' && e.cancelable) e.preventDefault();
  },
  { passive: false, capture: true },
);
document.addEventListener('pointerup', (e) => end(e, false), true);
document.addEventListener('pointercancel', (e) => end(e, true), true);
document.addEventListener(
  'click',
  (e) => {
    if (
      swallow &&
      Date.now() < swallow.until &&
      e.isTrusted &&
      e.target instanceof Node &&
      swallow.c.contains(e.target)
    ) {
      e.stopPropagation();
      e.preventDefault();
    }
  },
  true,
);
