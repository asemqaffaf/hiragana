import './i18n/en.js';
import './i18n/ar.js';
import './ui/sheet-swipe.js';
import './ui/home-button.js';
import {actx, htmlAudio, htmlFails, htmlOK, playTok} from './core/audio.js';
import {showTab} from './core/nav.js';
import {me, state, students} from './core/storage.js';
import {ui} from './core/ui-state.js';
import {KVG} from './data/kvg.js';
import {initTracking} from './features/gamify.js';
import {login, showLogin} from './features/login.js';
import {STR} from './i18n/core.js';
import {judgeStroke, parsePath, strokeTemplates} from './strokes/check.js';

document.getElementById('whoBtn').addEventListener('click', () => { if (ui.currentTab !== 'profile') showTab('profile'); });
function boot() {
  initTracking();
  const p = me();
  if (p) login(p.id);
  else showLogin();
}
boot();
if (/[#&]test\b/.test(location.hash)) window.__hira = {STR, wordsFor: k => { ui.rdFilter = ui.rdLetter = k; showTab('read', {letter: k}); }, phrasesFor: k => { ui.phFilter = ui.phLetter = k; showTab("phrases", {letter: k}); }, audioEl: () => htmlAudio, audioState: () => ({htmlOK, htmlFails, playTok, waState: actx && actx.state}), judgeStroke, strokeTemplates, parsePath, KVG, getState: () => state, getStudents: () => students};
