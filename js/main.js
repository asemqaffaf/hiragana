import './ui/sheet.js';
import './ui/sheet-swipe.js';
import './ui/home-button.js';
import './ui/drag-select.js';
import { actx, htmlAudio, htmlFails, htmlOK, playTok } from './core/audio.js';
import { showTab } from './core/nav.js';
import { clearCurrentStudent, state, students, subscribeProgress } from './core/store.js';
import { registerPages } from './core/pages.js';
import { startCloudSync } from './core/cloud.js';
import { recordLessonReading } from './core/lesson.js';
import { ui } from './core/ui-state.js';
import { KVG } from './data/kvg.js';
import { checkBadges, initTracking } from './features/gamify.js';
import { restoreLogin, showLogin } from './features/login.js';
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
