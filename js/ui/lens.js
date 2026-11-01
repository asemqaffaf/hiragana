/* The iOS 26 tab bar "lens". Press the bar and the selected pill lifts into a piece of glass that follows the finger on a
   spring, stretches with its speed like a drop of water, and magnifies the icons under it. On release it settles onto the
   nearest tab. The magnifier is a clipped window onto a second, scaled copy of the bar, so it needs no SVG filter and looks
   the same in Safari. Pure DOM and transforms; the physics is a damped spring run once per frame. */
const MAG = 1.24;                /* magnification inside the lens */
const K = 380, C = 26;           /* position spring: slightly underdamped, so it overshoots and settles */
const KL = 300, CL = 21;         /* lift spring: the lens grows out of the pill with a small pop */

/** @param {number} v @param {number} a @param {number} b */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** A pointer x position in the bar's own (unscaled) pixels. @param {HTMLElement} c @param {number} clientX */
export const toLocal = (c, clientX) => { const r = c.getBoundingClientRect(); return (clientX - r.left) / (r.width / (c.offsetWidth || 1)); };

/**
 * @typedef {object} Lens
 * @property {(clientX: number) => void} move
 * @property {(clientX: number, cancel?: boolean) => HTMLButtonElement | null} release the tab to settle on
 * @property {() => void} abort
 */
/**
 * @param {HTMLElement} c the tab bar
 * @param {number} clientX
 * @returns {Lens | null}
 */
export function createLens(c, clientX) {
  const items = /** @type {HTMLButtonElement[]} */ (Array.from(c.querySelectorAll(':scope > button'))).filter(b => !b.disabled && b.offsetWidth);
  if (!items.length) return null;
  const sel = items.find(b => b.getAttribute('aria-selected') === 'true') || items[0];
  const itemW = sel.offsetWidth, itemH = sel.offsetHeight, cw = c.offsetWidth, cy = sel.offsetTop + itemH / 2;
  /** @param {HTMLElement} b */
  const centre = b => b.offsetLeft + b.offsetWidth / 2;
  /** @param {number} x */
  const nearest = x => items.reduce((a, b) => Math.abs(x - centre(b)) < Math.abs(x - centre(a)) ? b : a);

  const lens = document.createElement('div'), inner = /** @type {HTMLElement} */ (c.cloneNode(true));
  lens.className = 'lens'; lens.setAttribute('aria-hidden', 'true');
  inner.querySelectorAll('.thumb, .lens').forEach(n => n.remove());
  inner.removeAttribute('id'); inner.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
  inner.classList.remove('has-thumb', 'dragging', 'lensing'); inner.classList.add('lensin'); inner.inert = true;
  inner.querySelectorAll('button').forEach(b => { b.removeAttribute('aria-selected'); b.removeAttribute('aria-pressed'); b.tabIndex = -1; });
  Object.assign(inner.style, {position: 'absolute', left: '0', top: '0', margin: '0', width: cw + 'px', height: c.offsetHeight + 'px', maxWidth: 'none', transformOrigin: '0 0'});
  const copies = Array.from(inner.querySelectorAll(':scope > button')).filter((b, i) => items[i]);
  lens.appendChild(inner); c.appendChild(lens); c.classList.add('lensing');

  const S = {x: centre(sel), v: 0, L: 0, vL: 0, tx: centre(sel), Lt: 1, released: false, done: false, on: -1, last: performance.now(), raf: 0};
  /** @param {number} x */
  const limit = x => clamp(x, itemW / 2 - 6, cw - itemW / 2 + 6);

  /** @param {number} now */
  const frame = now => {
    const dt = Math.min(0.032, (now - S.last) / 1000) || 0.016; S.last = now;
    S.v += (-K * (S.x - S.tx) - C * S.v) * dt; S.x += S.v * dt;
    S.vL += (-KL * (S.L - S.Lt) - CL * S.vL) * dt; S.L += S.vL * dt;
    const l = clamp(S.L, 0, 1.12), l1 = Math.min(l, 1), speed = Math.abs(S.v);
    const w = itemW * (1 + .12 * l) + Math.min(speed / 10, 56) * l1;           /* faster: longer ... */
    const h = itemH * (1 + .2 * l) - Math.min(speed / 110, 7) * l1;           /* ... and flatter */
    const cx = clamp(S.x, w / 2 - 12, cw - w / 2 + 12), lx = cx - w / 2, ly = cy - h / 2, M = 1 + (MAG - 1) * l;
    const a = Math.min(1, l * 1.7);
    lens.style.cssText = 'width:' + w + 'px;height:' + h + 'px;opacity:' + a + ';transform:translate3d(' + lx + 'px,' + ly + 'px,0)';
    inner.style.transform = 'translate(' + (-lx + cx - M * cx) + 'px,' + (-ly + cy - M * cy) + 'px) scale(' + M + ')';
    c.style.setProperty('--thumb-o', String(1 - a));
    const i = items.indexOf(nearest(cx)); if (i !== S.on) { S.on = i; copies.forEach((b, j) => b.classList.toggle('on', j === i)); }
    if (S.released && S.L < 0.015 && Math.abs(S.x - S.tx) < 0.35 && Math.abs(S.v) < 8 && Math.abs(S.vL) < 0.05) return end();
    S.raf = requestAnimationFrame(frame);
  };
  const end = () => { S.done = true; cancelAnimationFrame(S.raf); lens.remove(); c.classList.remove('lensing'); c.style.removeProperty('--thumb-o'); };
  S.raf = requestAnimationFrame(frame);
  S.tx = limit(toLocal(c, clientX));

  return {
    move(clientX) { if (!S.done && !S.released) S.tx = limit(toLocal(c, clientX)); },
    /* lift the finger: settle on the nearest tab (or back on the one that was selected) and hand it back */
    release(clientX, cancel) {
      if (S.done) return null;
      const target = cancel ? sel : nearest(limit(toLocal(c, clientX)));
      S.released = true; S.Lt = 0; S.tx = centre(target);
      return target;
    },
    abort() { if (!S.done) end(); }
  };
}
