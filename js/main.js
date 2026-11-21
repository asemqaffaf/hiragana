import './ui/sheet.js';
import './ui/sheet-swipe.js';
import './ui/home-button.js';
import './ui/drag-select.js';
import './ui/glass.js';
import './ui/no-zoom.js';
import './ui/repeat.js';
import { actx, htmlAudio, htmlFails, htmlOK, playTok } from './core/audio.js';
import { showTab } from './core/nav.js';
import { clearCurrentStudent, me, state, students, subscribeProgress } from './core/store.js';
import { registerPages } from './core/pages.js';
import { startCloudSync, subscribeCloudApplied } from './core/cloud.js';
import { recordLessonReading } from './core/lesson.js';
import { ui } from './core/ui-state.js';
import { KVG } from './data/kvg.js';
import { checkBadges, initTracking } from './features/gamify.js';
import { renderWho, restoreLogin, showLogin } from './features/login.js';
import { deviceLang, setLang } from './features/language.js';
import { applyStudent } from './ui/appearance.js';
import { renderAll } from './core/render-all.js';
import { renderChart } from './features/chart.js';
import { renderDaily, renderPhrases } from './features/daily.js';
import { renderDrill } from './features/drill.js';
import { enterMeet, renderMeet } from './features/lesson.js';
import { renderPlan } from './features/plan.js';
import { renderProfile } from './features/profile.js';
import { renderProgress } from './features/progress.js';
import { renderRead } from './features/read.js';
import { renderWrite } from './features/write.js';
import { STR } from './i18n/core.js';
import { judgeStroke, parsePath, strokeTemplates } from './strokes/check.js';
import { must } from './util.js';

must('#whoBtn').addEventListener('click', () => {
  if (ui.currentTab !== 'profile') showTab('profile');
});
/** Show what another device saved, without redrawing a screen someone is working on (pages redraw when opened). */
subscribeCloudApplied((id) => {
  const student = me();
  if (!student || student.id !== id || document.body.classList.contains('signed-out')) return;
  renderWho();
  applyStudent();
  if (ui.session || ui.currentTab === 'write' || ui.currentTab === 'meet') return;
  setLang(student.lang || deviceLang());
  renderAll();
});
function boot() {
  registerPages({
    plan: { render: renderPlan },
    meet: { enter: enterMeet, render: renderMeet },
    daily: { render: renderDaily },
    progress: { render: renderProgress },
    chart: { render: renderChart },
    drill: { render: renderDrill, shouldRender: () => !ui.session || !!ui.session.done },
    write: { render: renderWrite },
    read: { enter: recordLessonReading, render: renderRead },
    phrases: { render: renderPhrases },
    profile: { render: renderProfile },
  });
  subscribeProgress(() => checkBadges(false));
  initTracking();
  startCloudSync();
  if (!restoreLogin()) {
    clearCurrentStudent();
    showLogin();
  }
}
boot();
// Tell the safety net in index.html that the app started, and tidy the address after a fresh-copy retry.
/** @type {any} */ (window).__booted = true;
try {
  sessionStorage.removeItem('hira-retry');
  if (/[?&]r=\d+/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
} catch (e) {}
/* The loading screen (index.html) stays until the first screen is drawn, the stylesheets and theme are applied and the fonts
   are loaded, so nothing shows in a fallback font or the wrong colours. It shows for at least 700 ms (no flash) and never
   longer than 6 s (a slow or blocked font must not trap the app). */
const splash = document.getElementById('splash');
if (splash) {
  const started = performance.now();
  const wait = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
  const pageLoaded = document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => addEventListener('load', () => r(undefined), { once: true }));
  const fonts = Promise.all(
    ['400 16px "Zen Kaku Gothic New"', '700 16px "Zen Kaku Gothic New"', '400 16px "Klee One"', '400 16px "IBM Plex Sans Arabic"', '700 16px "IBM Plex Sans Arabic"'].map((f) =>
      document.fonts.load(f, 'あアAa').catch(() => []),
    ),
  ).then(() => document.fonts.ready);
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined))));
  Promise.race([Promise.all([pageLoaded, fonts, nextFrame()]), wait(6000)]).then(async () => {
    await wait(Math.max(0, 700 - (performance.now() - started)));
    splash.classList.add('gone');
    setTimeout(() => splash.remove(), 450);
  });
}
if (/[#&]test\b/.test(location.hash))
  window.__hira = {
    STR,
    wordsFor: (/** @type {string} */ k) => {
      ui.rdFilter = ui.rdLetter = k;
      showTab('read', { letter: k });
    },
    phrasesFor: (/** @type {string} */ k) => {
      ui.phFilter = ui.phLetter = k;
      showTab('phrases', { letter: k });
    },
    audioEl: () => htmlAudio,
    audioState: () => ({ htmlOK, htmlFails, playTok, waState: actx && actx.state }),
    judgeStroke,
    strokeTemplates,
    parsePath,
    KVG,
    getState: () => state,
    getStudents: () => students,
  };
