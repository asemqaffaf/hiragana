import { isRepeating, repeatSpeak, stopRepeat } from '../core/audio.js';
import { t } from '../i18n/core.js';

/* Press and hold a letter, word or phrase to repeat its sound.
   Holding for a moment opens a small glass menu next to what was pressed: 4, 8, 10, 20, 40 or 100 times. One tap on a number
   starts at once; a floating pill (count, progress bar, Stop) stays above the tab bar while it plays. The last number is
   remembered and marked, so repeating the same amount again is a single tap. A short tap still does what it always did.
   Mouse and keyboard: right-click, or the menu key, opens the same menu.
   What is repeatable: anything with data-rep (a clip key or Japanese text), a data-say speaker button or its word card,
   a Today card (data-dw), and a letter tile in the chart. */

const COUNTS = [4, 8, 10, 20, 40, 100];
const HOLD_MS = 420; /* long enough that a normal tap or a scroll never triggers it */
const ARM_MS = 140; /* the pressed item starts to sink after this, so the hold visibly "takes" */
const SLOP = 10; /* finger drift in px that still counts as holding still */
const KEY = 'hiragana14-repeat-n';
const HINT_KEY = 'hiragana14-repeat-hint';
const TARGETS = '[data-rep], [data-dw], [data-say], .kb[data-open], [data-word], .dcard, .mx';

/** @param {Element} el @returns {string} the clip key or Japanese text this element plays */
function clipOf(el) {
  if (!(el instanceof HTMLElement)) return '';
  const d = el.dataset;
  if (d.rep) return d.rep;
  if (d.dw) return d.dw + '|dw';
  if (d.say) return d.say;
  if (d.open && el.classList.contains('kb')) return d.open;
  const inner = el.querySelector('[data-say], [data-dw]');
  if (!(inner instanceof HTMLElement)) return '';
  return inner.dataset.dw ? inner.dataset.dw + '|dw' : inner.dataset.say || '';
}
/** The text to show for a clip key (the Japanese, without the "|dw" or "|ex" suffix). @param {string} key */
const labelOf = (key) => key.split('|')[0];
/** @param {EventTarget | null} target @returns {HTMLElement | null} */
function targetOf(target) {
  if (!(target instanceof Element)) return null;
  const el = target.closest(TARGETS);
  return el instanceof HTMLElement && clipOf(el) && !el.closest('.rep-pop, .rep-now') ? el : null;
}
const lastCount = () => {
  try {
    const n = Number(localStorage.getItem(KEY));
    return COUNTS.includes(n) ? n : 0;
  } catch (e) {
    return 0;
  }
};
/** @param {number} n */
const saveCount = (n) => {
  try {
    localStorage.setItem(KEY, String(n));
  } catch (e) {}
};

/* ---------- a small tap you can feel, when the menu opens ----------
   Android and most browsers: the Vibration API. iPhone Safari has no such API, but it gives a light haptic tick whenever a
   native switch (<input type=checkbox switch>, iOS 17.4+) is toggled, so a hidden one is clicked instead. */
/** @type {HTMLElement | null} */
let tick = null;
function haptic() {
  try {
    if (navigator.vibrate && navigator.vibrate(20)) return;
    if (!tick) {
      tick = document.createElement('label');
      tick.setAttribute('aria-hidden', 'true');
      tick.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.setAttribute('switch', '');
      box.tabIndex = -1;
      tick.appendChild(box);
      document.body.appendChild(tick);
    }
    tick.click();
  } catch (e) {}
}

/* iPhone since iOS 26.5: a script can no longer make the switch tick, but a real finger tap on a native switch still does.
   So on iPhone each button of the repeat menu gets a transparent label with a switch laid over it; the tap lands on the
   label (a trusted click, so the system plays its tick), and we then run the button's own action. There is no way to buzz
   at the moment the hold opens the menu: only a real tap can. */
const iosTicks = () => !navigator.vibrate && matchMedia('(pointer: coarse)').matches;
/** @param {HTMLButtonElement} btn  @returns {HTMLElement} what to put in the page in place of the button */
function withTick(btn) {
  if (!iosTicks()) return btn;
  const wrap = document.createElement('span');
  wrap.className = 'rep-tw';
  const lab = document.createElement('label');
  lab.className = 'rep-tk';
  lab.setAttribute('aria-hidden', 'true');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.setAttribute('switch', '');
  box.tabIndex = -1;
  lab.appendChild(box);
  lab.addEventListener('click', (e) => {
    e.stopPropagation();
    if (e.target !== box) return; /* a tap on the switch itself, or on the label (which forwards it to the switch) */
    box.checked = false;
    btn.click();
  });
  wrap.append(btn, lab);
  return wrap;
}

/* ---------- the hold ---------- */
/** @type {{ el: HTMLElement, id: number, x: number, y: number, hold: ReturnType<typeof setTimeout>, arm: ReturnType<typeof setTimeout> } | null} */
let press = null;
/** The click that ends a long press must not also "tap" the item (open the letter, toggle the word card). */
let swallowClick = false;

function cancelPress() {
  if (!press) return;
  clearTimeout(press.hold);
  clearTimeout(press.arm);
  press.el.classList.remove('rep-arming');
  press = null;
}

document.addEventListener(
  'pointerdown',
  (e) => {
    swallowClick = false;
    if (e.button > 0 || !e.isPrimary || picker) return;
    const el = targetOf(e.target);
    if (!el) return;
    cancelPress();
    press = {
      el,
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      arm: setTimeout(() => el.classList.add('rep-arming'), ARM_MS),
      hold: setTimeout(() => {
        const p = press;
        if (!p || !p.el.isConnected) return cancelPress();
        cancelPress();
        haptic(); /* before swallowClick: the iPhone trick below sends a click of its own */
        swallowClick = true;
        openPicker(p.el);
      }, HOLD_MS),
    };
  },
  true,
);
document.addEventListener(
  'pointermove',
  (e) => {
    if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > SLOP) cancelPress();
  },
  true,
);
for (const type of ['pointerup', 'pointercancel', 'dragstart'])
  document.addEventListener(
    type,
    () => {
      cancelPress();
      /* the click that ends a long press comes right after pointerup; if none comes (a keyboard press later) do not eat it */
      if (swallowClick) setTimeout(() => (swallowClick = false), 400);
    },
    true,
  );
document.addEventListener('scroll', cancelPress, { capture: true, passive: true });
document.addEventListener(
  'click',
  (e) => {
    if (swallowClick) {
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    countTap(e.target);
  },
  true,
);
/* right-click or the menu key on a mouse or keyboard; Android also sends this on a long press, after we have opened already */
document.addEventListener(
  'contextmenu',
  (e) => {
    const el = targetOf(e.target);
    if (!el) return;
    e.preventDefault();
    if (!picker) {
      cancelPress();
      openPicker(el);
    }
  },
  true,
);

/* ---------- the menu ---------- */
/** @type {{ el: HTMLElement, scrim: HTMLElement, prevFocus: Element | null } | null} */
let picker = null;

/** @param {HTMLElement} el */
function openPicker(el) {
  closePicker();
  const key = clipOf(el);
  if (!key) return;
  const word = labelOf(key);
  const last = lastCount();
  const scrim = document.createElement('div');
  scrim.className = 'rep-scrim';
  const pop = document.createElement('div');
  pop.className = 'rep-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', t('rep.menu', { w: word }));
  const head = document.createElement('div');
  head.className = 'rep-head';
  const k = document.createElement('span');
  k.className = 'rep-k';
  k.dir = 'ltr';
  k.textContent = word;
  const title = document.createElement('span');
  title.className = 'rep-title';
  title.textContent = t('rep.title');
  head.append(k, title);
  const grid = document.createElement('div');
  grid.className = 'rep-grid';
  for (const n of COUNTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rep-n' + (n === last ? ' last' : '');
    b.dataset.n = String(n);
    b.setAttribute('aria-label', t('rep.pick', { w: word, n }));
    b.innerHTML = '<b>' + n + '</b><span aria-hidden="true">&times;</span>';
    b.onclick = () => {
      saveCount(n);
      closePicker();
      startRepeat(key, n);
    };
    grid.appendChild(withTick(b));
  }
  pop.append(head, grid);
  scrim.appendChild(pop);
  /* a tap on the empty area closes it. It must be a whole tap that began on the scrim: the pointer-up that ended the hold
     (a mouse, mostly) must not close the menu it just opened. */
  let armed = false;
  scrim.addEventListener('pointerdown', (e) => {
    armed = e.target === scrim;
  });
  scrim.addEventListener('click', (e) => {
    if (armed && e.target === scrim) closePicker();
    armed = false;
  });
  scrim.addEventListener('contextmenu', (e) => e.preventDefault());
  picker = { el, scrim, prevFocus: document.activeElement };
  el.classList.add('rep-held');
  document.body.appendChild(scrim);
  place(pop, el);
  const first = /** @type {HTMLElement | null} */ (pop.querySelector('.last') || pop.querySelector('.rep-n'));
  if (first) first.focus({ preventScroll: true });
}

/** Put the menu above the pressed item (below it when there is no room), kept inside the screen. @param {HTMLElement} pop @param {HTMLElement} el */
function place(pop, el) {
  const r = el.getBoundingClientRect();
  const vw = document.documentElement.clientWidth,
    vh = innerHeight;
  const w = pop.offsetWidth,
    h = pop.offsetHeight,
    m = 10;
  let top = r.top - h - 12;
  const above = top >= 56;
  if (!above) top = r.bottom + 12;
  top = Math.max(m, Math.min(top, vh - h - m));
  const left = Math.max(m, Math.min(r.left + r.width / 2 - w / 2, vw - w - m));
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
  /* grow out of the pressed item */
  pop.style.transformOrigin = r.left + r.width / 2 - left + 'px ' + (above ? '100%' : '0%');
}

function closePicker() {
  const p = picker;
  if (!p) return;
  picker = null;
  p.el.classList.remove('rep-held');
  p.scrim.remove();
  const f = p.prevFocus;
  if (f instanceof HTMLElement && f.isConnected && f !== document.body) f.focus({ preventScroll: true });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && picker) {
    e.preventDefault();
    closePicker();
  }
});
addEventListener('resize', closePicker);
addEventListener('orientationchange', closePicker);

/* ---------- playing ---------- */
/** @type {HTMLElement | null} */
let pill = null;

/** @param {string} key @param {number} n */
function startRepeat(key, n) {
  removePill();
  const word = labelOf(key);
  const el = document.createElement('div');
  el.className = 'rep-now';
  el.setAttribute('role', 'group');
  el.innerHTML =
    '<span class="rep-now-k" dir="ltr"></span><span class="rep-now-c"></span>' +
    '<span class="rep-bar" aria-hidden="true"><i></i></span><button type="button" class="rep-stop"></button>';
  const stop = /** @type {HTMLButtonElement} */ (el.querySelector('.rep-stop'));
  stop.setAttribute('aria-label', t('rep.stop'));
  stop.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>';
  stop.onclick = () => stopRepeat();
  el.appendChild(withTick(stop));
  /** @type {HTMLElement} */ (el.querySelector('.rep-now-k')).textContent = word;
  document.body.appendChild(el);
  pill = el;
  el.setAttribute('aria-label', t('rep.playing', { w: word, i: 1, n }));
  const count = /** @type {HTMLElement} */ (el.querySelector('.rep-now-c'));
  repeatSpeak(key, n, {
    title: word,
    onPlay(i, total) {
      if (pill !== el) return;
      count.textContent = t('rep.progress', { i, n: total });
      el.style.setProperty('--p', String(i / total));
      el.setAttribute('aria-label', t('rep.playing', { w: word, i, n: total }));
    },
    onEnd() {
      if (pill === el) removePill();
    },
  });
}
function removePill() {
  const el = pill;
  if (!el) return;
  pill = null;
  el.classList.add('out');
  setTimeout(() => el.remove(), 260);
}

/* ---------- a hint, once ---------- */
let taps = 0;
/** After a few plain taps on something repeatable, say once that holding repeats it. @param {EventTarget | null} target */
function countTap(target) {
  if (picker || isRepeating()) return;
  const el = targetOf(target);
  if (!el || !el.closest('[data-say], [data-dw], .kb, [data-word], .mx, .dcard')) return;
  if (++taps < 4) return;
  try {
    if (localStorage.getItem(HINT_KEY)) return;
    localStorage.setItem(HINT_KEY, '1');
  } catch (e) {
    return;
  }
  const hint = document.createElement('div');
  hint.className = 'rep-hint';
  hint.setAttribute('role', 'status');
  hint.textContent = t('rep.hint');
  document.body.appendChild(hint);
  setTimeout(() => hint.classList.add('out'), 3800);
  setTimeout(() => hint.remove(), 4100);
}
