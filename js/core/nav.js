import { enterAnim, pageSnapshot, replay } from './motion.js';
import { ui } from './ui-state.js';
import { enterPage } from './pages.js';
import { moveThumb } from '../ui/thumb.js';
import { t } from '../i18n/core.js';
import { closeSheet } from '../ui/sheet-state.js';
import { $, $$, must } from '../util.js';

/* ---------- tabs and back navigation ---------- */
/* Each tab change is a browser history entry (#plan, #write ...), so the phone's back gesture moves between
   pages. An open card (sheet) is its own entry, so back closes the card first. */
/** @type {readonly import('../../types/app').TabName[]} */
export const TABS = [
  'plan',
  'meet',
  'daily',
  'progress',
  'chart',
  'drill',
  'write',
  'read',
  'phrases',
  'profile',
];
/** @type {Record<import('../../types/app').TabName, import('../../types/app').NavGroup>} */
const GROUP = {
  plan: 'home',
  meet: 'home',
  daily: 'home',
  phrases: 'practice',
  chart: 'letters',
  drill: 'practice',
  write: 'practice',
  read: 'practice',
  progress: 'progress',
  profile: 'profile',
};
/** The pages the tab bar and the profile button open: they have no Back button. @type {readonly import('../../types/app').TabName[]} */
const ROOT_PAGES = ['plan', 'chart', 'drill', 'progress', 'profile'];
/** Pages shown as a segmented control under the top bar. @type {Record<'practice', readonly import('../../types/app').TabName[]>} */
const SUBTABS = { practice: ['drill', 'write', 'read', 'phrases'] };
/** The page each group opens when its tab is tapped. @type {Record<'practice', import('../../types/app').TabName>} */
const lastSub = { practice: 'drill' };
/** @param {unknown} name @returns {name is import('../../types/app').TabName} */
export const isTab = (name) => typeof name === 'string' && TABS.some((tab) => tab === name);
/** @param {import('../../types/app').TabName} name */
function renderSubnav(name) {
  const el = $('#subnav'),
    g = GROUP[name];
  if (!el) return;
  if (g !== 'practice' || document.body.classList.contains('signed-out')) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  const subs = SUBTABS[g];
  lastSub[g] = name;
  el.hidden = false;
  el.innerHTML =
    '<div class="seg" role="tablist" aria-label="' +
    t(`nav.${g}`) +
    '">' +
    subs
      .map(
        (s) =>
          '<button role="tab" data-sub="' +
          s +
          '" aria-selected="' +
          (s === name) +
          '" aria-pressed="' +
          (s === name) +
          '">' +
          t(`tab.${s}`) +
          '</button>',
      )
      .join('') +
    '</div>';
  moveThumb($('.seg', el), 'subnav');
  $$('[data-sub]', el).forEach(
    (b) =>
      (b.onclick = () => {
        const sub = b.dataset.sub;
        if (isTab(sub) && sub !== ui.currentTab)
          showTab(sub, { root: ui.rootView, letter: carryLetter(sub) });
      }),
  );
}
/* The letter that Words and Phrases follow: from Write it is the letter being written, and between Words and Phrases it stays while the page is filtered */
/** @param {import('../../types/app').TabName} to */
function carryLetter(to) {
  if (to !== 'phrases' && to !== 'read') return undefined;
  if (ui.currentTab === 'write') return ui.writeK || undefined;
  if (ui.currentTab === 'read') return ui.rdFilter || undefined;
  if (ui.currentTab === 'phrases') return ui.phFilter || undefined;
  return undefined;
}
/** @param {{tab: import('../../types/app').TabName, sheet?: boolean}} st @param {boolean} [replace] */
function setHist(st, replace) {
  try {
    history[replace ? 'replaceState' : 'pushState'](st, '', '#' + st.tab);
  } catch (e) {}
}
/**
 * @param {string} requested a tab name; anything unknown opens Today
 * @param {import('../../types/app').ShowTabOptions} [opts]
 */
export function showTab(requested, opts = {}) {
  const name = isTab(requested) ? requested : 'plan';
  if (opts.initial) {
    ui.navStack = [];
    setHist({ tab: name }, true);
  } else if (!opts.fromHistory && name !== ui.currentTab) {
    ui.navStack.push(ui.currentTab);
    setHist({ tab: name }, !!opts.replace);
  }
  ui.rootView = opts.fromHistory ? name === 'plan' || name === 'chart' : !!opts.root;
  const prevTab = ui.currentTab;
  const snap =
    name !== prevTab
      ? pageSnapshot($('#tab-' + prevTab), opts)
      : null; /* the page being left, kept on screen while it slides away */
  if (name === 'phrases') {
    if (opts.letter !== undefined) ui.phFilter = ui.phLetter = opts.letter;
    else if (!opts.fromHistory) ui.phFilter = ui.phLetter = null;
  }
  if (name === 'read') {
    if (opts.letter !== undefined) ui.rdFilter = ui.rdLetter = opts.letter;
    else if (!opts.fromHistory) ui.rdFilter = ui.rdLetter = null;
  }
  ui.currentTab = name;
  $$('nav.tabs button').forEach((b) =>
    b.setAttribute('aria-selected', b.dataset.nav === GROUP[name] ? 'true' : 'false'),
  );
  const wb = $('#whoBtn');
  if (wb) {
    if (name === 'profile') wb.setAttribute('aria-current', 'page');
    else wb.removeAttribute('aria-current');
  }
  moveThumb($('nav.tabs .in'), 'tabs');
  renderSubnav(name);
  $$('.tab').forEach((s) => {
    s.hidden = s.id !== 'tab-' + name;
  });
  enterPage(name, opts);
  renderBack();
  window.scrollTo(0, 0);
  enterAnim(name, opts, prevTab, snap);
}
export function renderBack() {
  const bar = $('#backBar'),
    prev = ui.navStack[ui.navStack.length - 1];
  if (!bar) return;
  /* as in iOS: the pages the tab bar opens (Today, Letters, Practice, Progress) and Profile have no Back; every page opened from them does */
  bar.hidden = ROOT_PAGES.includes(ui.currentTab) || document.body.classList.contains('signed-out');
  const page = t(`tab.${prev && prev !== ui.currentTab ? prev : 'plan'}`),
    lab = must('#backLabel');
  /* the capsule shows where Back goes; the full sentence is its accessible name */
  must('#backBtn').setAttribute('aria-label', t('backTo', { page }));
  if (lab.textContent !== page) {
    lab.textContent = page;
    if (!bar.hidden) replay(lab, 'lblswap');
  }
}
must('#backBtn').addEventListener('click', () => {
  if (ui.navStack.length) history.back();
  else showTab('plan');
});
window.addEventListener('popstate', (e) => {
  if (document.body.classList.contains('signed-out')) return;
  if (ui.sheetPushed) {
    ui.sheetPushed = false;
    if (must('#sheetRoot').innerHTML) {
      closeSheet('pop');
      return;
    }
  }
  const st = e.state || {},
    h = location.hash.slice(1);
  const tab = isTab(st.tab) ? st.tab : isTab(h) ? h : 'plan';
  if (tab === ui.currentTab) return;
  if (ui.navStack[ui.navStack.length - 1] === tab) ui.navStack.pop();
  else ui.navStack.push(ui.currentTab);
  showTab(tab, { fromHistory: true });
});
export function markSheetOpen() {
  if (!ui.sheetPushed) {
    ui.sheetPushed = true;
    setHist({ tab: ui.currentTab, sheet: true });
  }
}
/* A tap on the tab bar answers at once (the highlight glides straight to it). The page behind it is drawn on the next
   frame, and when several taps come quickly only the last one is drawn, so the bar never waits for pages nobody looks at. */
let tabTap = 0;
/** @param {string} group */
const markTabs = (group) => {
  $$('nav.tabs button').forEach((x) =>
    x.setAttribute('aria-selected', x.dataset.nav === group ? 'true' : 'false'),
  );
  moveThumb($('nav.tabs .in'), 'tabs');
};
$$('nav.tabs button').forEach((b) =>
  b.addEventListener('click', () => {
    const g = b.dataset.nav ?? '',
      target =
        g === 'letters'
          ? 'chart'
          : g === 'progress'
            ? 'progress'
            : g === 'practice'
              ? lastSub.practice
              : 'plan',
      id = ++tabTap;
    if (target === ui.currentTab) {
      markTabs(GROUP[ui.currentTab]);
      window.scrollTo(0, 0);
      return;
    }
    markTabs(g);
    requestAnimationFrame(() =>
      setTimeout(() => {
        if (id === tabTap) showTab(target, { root: true });
      }, 0),
    );
  }),
);

/* iOS 26: the tab bar shrinks to icons while the page scrolls down and comes back when it scrolls up or reaches the top */
(function () {
  let lastY = window.scrollY,
    ticking = false;
  const root = document.documentElement;
  const update = () => {
    ticking = false;
    /* the position is held inside the page: iOS stretches past the bottom and springs back, and that bounce is not scrolling up */
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
      y = Math.min(Math.max(window.scrollY, 0), max);
    if (y < 40 || y < lastY - 6) root.classList.remove('navmin');
    else if (y > lastY + 6) root.classList.add('navmin');
    if (Math.abs(y - lastY) > 6 || y < 40) lastY = y;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  /* the highlight is measured in pixels, so measure again when the size of the screen changes */
  window.addEventListener('resize', () => {
    moveThumb($('nav.tabs .in'), 'tabs', true);
    moveThumb($('#subnav .seg'), 'subnav', true);
    moveThumb($('#tab-chart .seg'), 'chart', true);
    moveThumb($('#tab-progress .seg'), 'pgseg', true);
  });
})();
