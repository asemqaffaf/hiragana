import { bindSay, cacheClip, exampleHtml, moreExHtml, speakFull } from '../core/audio.js';
import { replay } from '../core/motion.js';
import { showTab } from '../core/nav.js';
import { curDay, focusKana, todayPool } from '../core/plan.js';
import { lesson, markLetterMet, nextLessonStep, writeList } from '../core/lesson.js';
import { ui } from '../core/ui-state.js';
import { me } from '../core/store.js';
import { rom } from '../data/letters.js';
import { startDrill } from './drill.js';
import { groupOf } from '../data/writing.js';
import { t } from '../i18n/core.js';
import { explain } from '../i18n/helpers.js';
import { strokeSVG } from '../strokes/draw.js';
import { SPEAK_SVG, must } from '../util.js';

/* ---------- guided daily lesson ---------- */
/** Opens the screen for a lesson step. @param {import('../../types/app').LessonStepId} id */
export function runStep(id) {
  const focus = focusKana(curDay()),
    x = lesson();
  if (id === 'meet') {
    ui.meetI = Math.max(
      0,
      focus.findIndex((k) => !x.m.includes(k)),
    );
    showTab('meet');
  } else if (id === 'write') {
    const wl = writeList();
    ui.lessonWrite = true;
    ui.lessonWritingSequence = null;
    ui.writeK = wl.find((k) => !x.w.includes(k)) || wl[0];
    ui.writeGroup = groupOf(ui.writeK);
    ui.writeCheck = true;
    showTab('write');
  } else if (id === 'read') showTab('read');
  else if (id === 'words') showTab('daily');
  else {
    const pool = todayPool();
    ui.lessonQuiz = true;
    ui.drillMode = 'read';
    ui.drillLen = Math.min(20, Math.max(10, pool.length));
    ui.session = null;
    showTab('drill');
    startDrill(pool);
  }
}
/** @type {ReturnType<typeof setTimeout> | undefined} */
let meetAudioTimer;
/** The letter shown by the last render, to flip the card only when it changes. @type {number | undefined} */
let lastMeetIndex;
/** @param {import('../../types/app').ShowTabOptions} [opts] `initial` is the first page of a visit: nothing may start playing by itself */
export function enterMeet(opts = {}) {
  clearTimeout(meetAudioTimer);
  const list = focusKana(curDay());
  if (!list.length) return;
  ui.meetI = Math.min(Math.max(ui.meetI, 0), list.length - 1);
  markLetterMet(list[ui.meetI]);
  const kana = list[ui.meetI],
    student = me();
  if (opts.initial) return;
  meetAudioTimer = setTimeout(() => {
    if (me() === student && ui.currentTab === 'meet' && focusKana(curDay())[ui.meetI] === kana)
      speakFull(kana);
  }, 300);
}

/** @param {number} offset */
function moveMeet(offset) {
  ui.meetI += offset;
  enterMeet();
  renderMeet();
}

export function renderMeet() {
  const list = focusKana(curDay());
  if (!list.length) {
    showTab('plan', { replace: true });
    return;
  }
  ui.meetI = Math.min(Math.max(ui.meetI, 0), list.length - 1);
  const k = list[ui.meetI],
    last = ui.meetI === list.length - 1;
  let h =
    '<div class="meettop"><span class="small muted">' +
    t('meet.count', { i: ui.meetI + 1, n: list.length }) +
    '</span><div class="rbar"><i style="width:' +
    Math.round(((ui.meetI + 1) / list.length) * 100) +
    '%"></i></div></div>';
  h +=
    '<div class="meetcard"><div class="sq meetsq" id="meetSq">' +
    (k.length > 1 ? '<span class="k txt">' + k + '</span>' : '') +
    '</div>';
  h += '<div class="meetrom ltr">' + rom(k) + '</div>';
  h +=
    '<button class="btn primary bigbtn" id="meetHear">' +
    SPEAK_SVG.replace('<svg', '<svg width="24" height="24"') +
    ' ' +
    t('card.hear') +
    '</button>';
  h += '<p class="hook">' + explain(k) + '</p>' + exampleHtml(k) + moreExHtml(k) + '</div>';
  h +=
    '<div class="btnrow meetnav actionbar"><button class="btn" id="meetPrev"' +
    (ui.meetI ? '' : ' disabled') +
    '>' +
    t('meet.prev') +
    '</button><button class="btn primary" id="meetNext">' +
    (last ? t(nextLessonStep('meet') ? 'meet.finish' : 'meet.done') : t('meet.next')) +
    '</button></div>';
  const root = must('#tab-meet');
  root.innerHTML = '<h2>' + t('tab.meet') + '</h2>' + h;
  if (lastMeetIndex !== undefined && lastMeetIndex !== ui.meetI && ui.currentTab === 'meet')
    replay(must('.meetcard', root), 'flip');
  lastMeetIndex = ui.meetI;
  if (k.length === 1) {
    const svg = strokeSVG(k, { guide: true });
    if (svg) {
      must('#meetSq', root).appendChild(svg);
      setTimeout(() => svg.play(), 200);
    }
  }
  must('#meetHear', root).onclick = () => speakFull(k);
  bindSay(root);
  must('#meetPrev', root).onclick = () => moveMeet(-1);
  must('#meetNext', root).onclick = () => {
    if (last) {
      const next = nextLessonStep('meet');
      if (next) runStep(next);
      else showTab('plan');
    }
    else {
      moveMeet(1);
      window.scrollTo(0, 0);
    }
  };
  cacheClip(k + '|ex');
  if (list[ui.meetI + 1]) cacheClip(list[ui.meetI + 1] + '|ex');
}
