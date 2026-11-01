import {enterAnim} from './motion.js';
import {ui} from './ui-state.js';
import {renderChart} from '../features/chart.js';
import {renderDaily, renderPhrases} from '../features/daily.js';
import {renderDrill} from '../features/drill.js';
import {lesson, lessonOn, renderMeet, saveLesson} from '../features/lesson.js';
import {renderPlan} from '../features/plan.js';
import {renderProfile} from '../features/profile.js';
import {renderProgress} from '../features/progress.js';
import {renderRead} from '../features/read.js';
import {renderWrite} from '../features/write.js';
import {moveThumb} from '../ui/thumb.js';
import {t} from '../i18n/core.js';
import {closeSheet} from '../ui/sheet.js';
import {$, $$} from '../util.js';

/* ---------- tabs and back navigation ---------- */
/* Each tab change is a browser history entry (#plan, #write ...), so the phone's back gesture moves between
   pages. An open card (sheet) is its own entry, so back closes the card first. */
export const TABS = ['plan', 'meet', 'daily', 'progress', 'chart', 'drill', 'write', 'read', 'phrases', 'profile'];
const GROUP = {plan: 'home', meet: 'home', daily: 'home', phrases: 'practice', chart: 'letters', drill: 'practice', write: 'practice', read: 'practice', progress: 'progress', profile: 'profile'};
const SUBTABS = {practice: ['drill', 'write', 'read', 'phrases']};
let lastSub = {practice: 'drill'};
function renderSubnav(name) {
  const el = $('#subnav'), g = GROUP[name], subs = SUBTABS[g];
  if (!el) return;
  if (!subs || document.body.classList.contains('signed-out')) { el.hidden = true; el.innerHTML = ''; return; }
  lastSub[g] = name;
  el.hidden = false;
  el.innerHTML = '<div class="seg" role="tablist" aria-label="' + t('nav.' + g) + '">' + subs.map(s => '<button role="tab" data-sub="' + s + '" aria-selected="' + (s === name) + '" aria-pressed="' + (s === name) + '">' + t('tab.' + s) + '</button>').join('') + '</div>';
  moveThumb($('.seg', el), 'subnav');
  $$('[data-sub]', el).forEach(b => b.onclick = () => { if (b.dataset.sub !== ui.currentTab) showTab(b.dataset.sub, {root: ui.rootView, letter: carryLetter(b.dataset.sub)}); });
}
/* The letter that Words and Phrases follow: from Write it is the letter being written, and between Words and Phrases it stays while the page is filtered */
function carryLetter(to) {
  if (to !== 'phrases' && to !== 'read') return undefined;
  if (ui.currentTab === 'write') return ui.writeK || undefined;
  if (ui.currentTab === 'read') return ui.rdFilter || undefined;
  if (ui.currentTab === 'phrases') return ui.phFilter || undefined;
  return undefined;
}
function setHist(st, replace) { try { history[replace ? 'replaceState' : 'pushState'](st, '', '#' + st.tab); } catch (e) {} }
export function showTab(name, opts) {
  opts = opts || {};
  if (!TABS.includes(name)) name = 'plan';
  if (opts.initial) { ui.navStack = []; setHist({tab: name}, true); }
  else if (!opts.fromHistory && name !== ui.currentTab) { ui.navStack.push(ui.currentTab); setHist({tab: name}, !!opts.replace); }
  ui.rootView = opts.fromHistory ? (name === 'plan' || name === 'chart') : !!opts.root;
  const prevTab = ui.currentTab;
  if (name === 'phrases') { if (opts.letter !== undefined) ui.phFilter = ui.phLetter = opts.letter; else if (!opts.fromHistory) ui.phFilter = ui.phLetter = null; }
  if (name === 'read') { if (opts.letter !== undefined) ui.rdFilter = ui.rdLetter = opts.letter; else if (!opts.fromHistory) ui.rdFilter = ui.rdLetter = null; }
  ui.currentTab = name;
  $$('nav.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.nav === GROUP[name] ? 'true' : 'false'));
  const wb = $('#whoBtn'); if (wb) { if (name === 'profile') wb.setAttribute('aria-current', 'page'); else wb.removeAttribute('aria-current'); }
  moveThumb($('nav.tabs .in'), 'tabs');
  renderSubnav(name);
  $$('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + name; });
  if (name === 'write') renderWrite();
  if (name === 'drill' && (!ui.session || ui.session.done)) renderDrill();
  if (name === 'chart') renderChart();
  if (name === 'plan') renderPlan();
  if (name === 'progress') renderProgress();
  if (name === 'profile') renderProfile();
  if (name === 'meet') renderMeet();
  if (name === 'daily') renderDaily();
  if (name === 'phrases') renderPhrases();
  if (name === 'read') renderRead();
  if (name === 'read' && lessonOn()) { const x = lesson(); if (!x.r) { x.r = true; saveLesson(x); } }
  renderBack();
  window.scrollTo(0, 0);
  enterAnim(name, opts, prevTab);
}
export function renderBack() {
  const bar = $('#backBar'), prev = ui.navStack[ui.navStack.length - 1];
  if (!bar) return;
  /* always there, except on Today (the home page) and the login screen */
  bar.hidden = ui.currentTab === 'plan' || document.body.classList.contains('signed-out');
  $('#backLabel').textContent = t('backTo', {page: t('tab.' + (prev && prev !== ui.currentTab ? prev : 'plan'))});
}
$('#backBtn').addEventListener('click', () => { if (ui.navStack.length) history.back(); else showTab('plan'); });
window.addEventListener('popstate', e => {
  if (document.body.classList.contains('signed-out')) return;
  if (ui.sheetPushed) { ui.sheetPushed = false; if ($('#sheetRoot').innerHTML) { closeSheet('pop'); return; } }
  const st = e.state || {}, h = location.hash.slice(1);
  const tab = TABS.includes(st.tab) ? st.tab : (TABS.includes(h) ? h : 'plan');
  if (tab === ui.currentTab) return;
  if (ui.navStack[ui.navStack.length - 1] === tab) ui.navStack.pop(); else ui.navStack.push(ui.currentTab);
  showTab(tab, {fromHistory: true});
});
export function markSheetOpen() { if (!ui.sheetPushed) { ui.sheetPushed = true; setHist({tab: ui.currentTab, sheet: true}); } }
$$('nav.tabs button').forEach(b => b.addEventListener('click', () => {
  const g = b.dataset.nav, target = g === 'home' ? 'plan' : g === 'letters' ? 'chart' : g === 'progress' ? 'progress' : lastSub[g];
  if (target !== ui.currentTab) showTab(target, {root: true}); else window.scrollTo(0, 0);
}));

/* iOS 26: the tab bar shrinks to icons while the page scrolls down and comes back when it scrolls up or reaches the top */
(function () {
  let lastY = window.scrollY, ticking = false;
  const root = document.documentElement;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    if (y < 40 || y < lastY - 6) root.classList.remove('navmin');
    else if (y > lastY + 6) root.classList.add('navmin');
    if (Math.abs(y - lastY) > 6 || y < 40) lastY = y;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, {passive: true});
  /* the highlight is measured in pixels, so measure again when the size of the screen changes */
  window.addEventListener('resize', () => { moveThumb($('nav.tabs .in'), 'tabs', true); moveThumb($('#subnav .seg'), 'subnav', true); });
})();
