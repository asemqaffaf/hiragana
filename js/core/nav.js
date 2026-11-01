import {enterAnim} from './motion.js';
import {ui} from './ui-state.js';
import {renderChart} from '../features/chart.js';
import {renderDaily, renderPhrases} from '../features/daily.js';
import {renderDrill} from '../features/drill.js';
import {lesson, lessonOn, renderMeet, saveLesson} from '../features/lesson.js';
import {renderPlan} from '../features/plan.js';
import {renderProfile} from '../features/profile.js';
import {renderProgress} from '../features/progress.js';
import {renderWrite} from '../features/write.js';
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
  $$('[data-sub]', el).forEach(b => b.onclick = () => { if (b.dataset.sub !== ui.currentTab) showTab(b.dataset.sub, {root: ui.rootView, letter: b.dataset.sub === 'phrases' && ui.currentTab === 'write' && ui.writeK ? ui.writeK : undefined}); });
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
  ui.currentTab = name;
  $$('nav.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.nav === GROUP[name] ? 'true' : 'false'));
  const wb = $('#whoBtn'); if (wb) { if (name === 'profile') wb.setAttribute('aria-current', 'page'); else wb.removeAttribute('aria-current'); }
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
