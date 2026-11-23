import { showTab } from '../core/nav.js';
import { PL, PLEN, curDay, dayNumber, focusKana } from '../core/plan.js';
import { renderAll } from '../core/render-all.js';
import { me, state } from '../core/store.js';
import { resetProgress, setDayComplete, setStartDate } from '../core/progress.js';
import { ui } from '../core/ui-state.js';

import { isLessonStep, lessonSteps } from '../core/lesson.js';
import { runStep } from './lesson.js';
import { kb } from '../ui/letter-button.js';
import { presentSheet } from '../ui/sheet.js';
import { closeSheet } from '../ui/sheet-state.js';
import { syncText } from '../ui/student.js';
import { byline } from './language.js';
import { t } from '../i18n/core.js';
import { fmt } from '../i18n/helpers.js';
import { $, $$, addDays, esc, must, todayISO } from '../util.js';

const CHEVRON = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/** @param {string[]} list @param {boolean} dense */
function kanaSquares(list, dense) {
  return (
    '<div class="focus' +
    (dense ? ' dense' : '') +
    (list.some((k) => k.length === 2) ? ' yo' : '') +
    '">' +
    list.map((k) => kb(k)).join('') +
    '</div>'
  );
}
/** The card for one plan day: what it teaches, its tasks, and the way to mark it done or not. @param {number} day */
function openDaySheet(day) {
  const plan = PL()[day - 1];
  if (!plan) return;
  const doneOn = state.done[day],
    letters = focusKana(day);
  const root = presentSheet(
    t('plan.prevDay', { n: day, title: plan.t }),
    '<div class="dsh"><h3 class="dsh-title">' +
      t('plan.prevDay', { n: day, title: esc(plan.t) }) +
      '</h3><p class="dsh-date small muted">' +
      fmt(addDays(state.start, day - 1)) +
      (doneOn ? ' · ' + t('plan.prevDone', { date: fmt(doneOn) }) : '') +
      '</p>' +
      (letters.length
        ? '<p class="dsh-letters" aria-hidden="true">' +
          letters.map((k) => '<span>' + k + '</span>').join('') +
          '</p>'
        : '') +
      '<ol class="tasks">' +
      plan.tasks.map((x) => '<li>' + x + '</li>').join('') +
      '</ol><div class="btnrow"><button class="btn ' +
      (doneOn ? '' : 'primary') +
      '" id="dayToggle">' +
      (doneOn ? t('plan.markNotDone') : t('plan.markDone', { d: day })) +
      '</button></div></div>',
  );
  const toggle = must('#dayToggle', root);
  toggle.onclick = () => {
    closeSheet();
    setDayComplete(day, !state.done[day]);
    renderAll();
  };
  toggle.focus({ preventScroll: true });
}
/** Start date and reset, away from the main screen. */
function openSettingsSheet() {
  const root = presentSheet(
    t('plan.settingsT'),
    '<div class="dsh"><h3 class="dsh-title">' +
      t('plan.settingsT') +
      '</h3><p class="small muted dsh-help">' +
      t('plan.how1') +
      '</p><div class="srow"><label for="startDate">' +
      t('plan.startDate') +
      '</label><input type="date" id="startDate" value="' +
      state.start +
      '"></div><p class="small muted dsh-help">' +
      t('plan.missed') +
      '</p><div class="btnrow"><button class="btn danger" id="resetBtn">' +
      t('plan.reset') +
      '</button></div></div>',
  );
  const startDate = must('#startDate', root, HTMLInputElement);
  startDate.onchange = () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate.value)) {
      setStartDate(startDate.value);
      renderAll();
    }
  };
  const reset = must('#resetBtn', root);
  let armed = false;
  reset.onclick = () => {
    if (!armed) {
      armed = true;
      reset.classList.add('armed');
      reset.textContent = t('plan.resetConfirm', { name: (me() || { name: '' }).name });
      setTimeout(() => {
        if (!reset.isConnected) return;
        armed = false;
        reset.classList.remove('armed');
        reset.textContent = t('plan.reset');
      }, 4000);
      return;
    }
    closeSheet();
    resetProgress();
    renderAll();
  };
}
/** A tappable row of an inset list: label, optional value, chevron. @param {string} id @param {string} label @param {string} [value] */
const listRow = (id, label, value) =>
  '<li><button class="irow" id="' +
  id +
  '"><span class="il">' +
  label +
  '</span>' +
  (value ? '<span class="iv">' + value + '</span>' : '') +
  CHEVRON +
  '</button></li>';
function doneCount() {
  const total = PLEN();
  return Object.keys(state.done).filter((d) => Number(d) >= 1 && Number(d) <= total).length;
}
export function renderPlan() {
  const n = dayNumber(),
    day = curDay(),
    d = PL()[day - 1],
    L = PLEN();
  const focus = focusKana(day);
  let h = '';
  if (n < 1)
    h +=
      '<h2>' +
      t('plan.starts', { date: fmt(state.start) }) +
      '</h2><p class="date">' +
      t('plan.todayIs', { date: fmt(todayISO(), true) }) +
      '</p>';
  else if (n > L)
    h +=
      '<h2>' +
      t('plan.complete') +
      '</h2><p class="date">' +
      fmt(todayISO(), true) +
      '</p><p>' +
      t('plan.keep') +
      '</p><div class="btnrow"><button class="btn primary bigbtn" id="goWeak">' +
      t('plan.drillWeak') +
      '</button></div>';
  else {
    const steps = lessonSteps(),
      next = steps.find((x) => !x.done);
    h +=
      '<p class="eyebrowless date">' +
      fmt(todayISO(), true) +
      '</p><h2>' +
      t('plan.dayOf', { n, total: L }) +
      '</h2><p class="dtitle">' +
      d.t +
      '</p>';
    h +=
      '<div class="lesson"><ol class="steps">' +
      steps
        .map((x, i) => {
          const st = x.done ? 'done' : x === next ? 'now' : 'next';
          return (
            '<li class="' +
            st +
            '"><span class="snum" aria-hidden="true">' +
            (x.done ? CHECK : i + 1) +
            '</span><button class="sbody" data-step="' +
            x.id +
            '"><b>' +
            t(`step.${x.id}`) +
            '</b><span class="small muted">' +
            (x.id === 'quiz'
              ? x.score !== undefined && x.score >= 0
                ? t('step.quizScore', { p: x.score })
                : t('step.quizD')
              : x.m > 1
                ? t('rm.of', { v: x.n, m: x.m })
                : t(`step.${x.id}D`)) +
            '</span></button></li>'
          );
        })
        .join('') +
      '</ol>';
    h += !next
      ? '<p class="lessondone">' +
        t('lesson.done') +
        '</p><div class="btnrow"><button class="btn bigbtn" id="goMore">' +
        t('lesson.more') +
        '</button></div>'
      : '<div class="btnrow"><button class="btn primary bigbtn" id="goNext">' +
        (steps.indexOf(next) === 0 && next.n === 0
          ? t('lesson.start')
          : t('lesson.continue', { step: t(`step.${next.id}`) })) +
        '</button></div>';
    h += '</div>';
    if (focus.length)
      h += '<h3>' + t('plan.letters') + '</h3>' + kanaSquares(focus, focus.length > 12);
  }
  /* the rest is one tap away: each row opens a card or a page, nothing expands in place */
  h +=
    '<ul class="ilist">' +
    listRow('openDay', t('plan.tasksT')) +
    listRow('openDays', t('plan.allDays', { total: L }), '<bdi>' + doneCount() + ' / ' + L + '</bdi>') +
    listRow('openSettings', t('plan.settingsT')) +
    '</ul>';
  h +=
    '<footer class="credit"><p id="sync">' +
    syncText() +
    '</p><p>' +
    t('credits') +
    '</p>' +
    byline() +
    '</footer>';
  const root = must('#tab-plan');
  root.innerHTML = h;
  const gn = $('#goNext', root);
  if (gn)
    gn.onclick = () => {
      const step = lessonSteps().find((x) => !x.done);
      if (step) runStep(step.id);
    };
  $$('[data-step]', root).forEach(
    (b) =>
      (b.onclick = () => {
        if (isLessonStep(b.dataset.step)) runStep(b.dataset.step);
      }),
  );
  const gw = $('#goWeak', root);
  if (gw)
    gw.onclick = () => {
      ui.drillSel = new Set(['weak']);
      ui.session = null;
      showTab('drill');
    };
  const gm = $('#goMore', root);
  if (gm)
    gm.onclick = () => {
      ui.drillSel = new Set(['sofar']);
      ui.session = null;
      showTab('drill');
    };
  must('#openDay', root).onclick = () => openDaySheet(day);
  must('#openDays', root).onclick = () => showTab('days');
  must('#openSettings', root).onclick = openSettingsSheet;
}
/** The whole plan as one list; a tap opens that day's card. */
export function renderDays() {
  const n = dayNumber(),
    L = PLEN();
  let h =
    '<h2>' +
    t('plan.allDays', { total: L }) +
    '</h2><p class="small muted">' +
    t('pg.lessonsBig', { v: doneCount(), m: L }) +
    '</p><ol class="ilist days">';
  PL().forEach((p, i) => {
    const dn = i + 1,
      done = state.done[dn],
      fk = focusKana(dn),
      status = done ? 'done' : dn === n ? 'now' : dn < n ? 'open' : 'up';
    h +=
      '<li><button class="irow drow ' +
      status +
      '" data-day="' +
      dn +
      '"><span class="ldot" aria-hidden="true">' +
      (done ? CHECK : dn) +
      '</span><span class="lt"><b>' +
      p.t +
      '</b><span class="small muted">' +
      fmt(addDays(state.start, i)) +
      (done ? t('plan.doneSuffix') : '') +
      '</span></span><span class="kp" aria-hidden="true">' +
      fk.slice(0, 5).join('') +
      '</span>' +
      CHEVRON +
      '</button></li>';
  });
  h += '</ol>';
  const root = must('#tab-days');
  root.innerHTML = h;
  $$('[data-day]', root).forEach(
    (b) => (b.onclick = () => openDaySheet(Number(b.dataset.day))),
  );
}
