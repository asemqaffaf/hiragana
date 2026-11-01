import { showTab } from '../core/nav.js';
import { PL, PLEN, curDay, dayNumber, focusKana } from '../core/plan.js';
import { renderAll } from '../core/render-all.js';
import { me, state } from '../core/store.js';
import { resetProgress, setDayComplete, setStartDate } from '../core/progress.js';
import { ui } from '../core/ui-state.js';

import { isLessonStep, lessonSteps } from '../core/lesson.js';
import { runStep } from './lesson.js';
import { kb } from '../ui/letter-button.js';
import { syncText } from '../ui/student.js';
import { byline } from './language.js';
import { t } from '../i18n/core.js';
import { fmt } from '../i18n/helpers.js';
import { $, $$, addDays, esc, must, todayISO } from '../util.js';

/** @param {string | undefined} done the date the day was completed, if it was */
function circle(done) {
  return done
    ? '<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" transform="rotate(-110 22 22)"/></svg>'
    : '';
}
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
            (x.done ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : i + 1) +
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
  h +=
    '<details class="more fold"><summary>' +
    t('plan.tasksT') +
    '</summary><ol class="tasks">' +
    d.tasks.map((x) => '<li>' + x + '</li>').join('') +
    '</ol><div class="btnrow"><button class="btn ' +
    (state.done[day] ? '' : 'red') +
    '" id="markDone">' +
    t(state.done[day] ? 'plan.markedUndo' : 'plan.markDone', { d: day }) +
    '</button></div></details>';
  h +=
    '<details class="more fold"><summary>' +
    t('plan.allDays', { total: L }) +
    '</summary><div class="days">';
  PL().forEach((p, i) => {
    const dn = i + 1,
      fk = focusKana(dn),
      isCur = n >= 1 && n <= L && dn === n;
    h +=
      '<details' +
      (isCur ? ' class="cur"' : '') +
      '><summary><span class="dn">' +
      circle(state.done[dn]) +
      dn +
      '</span><span><span class="t">' +
      p.t +
      '</span><br><span class="d">' +
      fmt(addDays(state.start, i)) +
      (state.done[dn] ? t('plan.doneSuffix') : '') +
      '</span></span><span class="kp">' +
      (fk.length ? fk.slice(0, 10).join('') : '') +
      '</span></summary><div class="body"><ol class="tasks">' +
      p.tasks.map((x) => '<li>' + x + '</li>').join('') +
      '</ol>' +
      (fk.length ? kanaSquares(fk, true) : '') +
      '<button class="link" data-toggle-day="' +
      dn +
      '">' +
      t(state.done[dn] ? 'plan.markNotDone' : 'plan.markDoneShort') +
      '</button></div></details>';
  });
  h += '</div></details>';
  h +=
    '<details class="more fold"><summary>' +
    t('plan.settingsT') +
    '</summary><p>' +
    t('plan.how1') +
    '</p><p class="note">' +
    t('plan.missed') +
    '</p>';
  h +=
    '<div class="field"><label for="startDate" class="small muted">' +
    t('plan.startDate') +
    '</label><input type="date" id="startDate" value="' +
    state.start +
    '"></div>';
  h +=
    '<div class="btnrow"><button class="btn" id="resetBtn">' +
    (ui.resetArmed
      ? t('plan.resetConfirm', { name: esc((me() || { name: '' }).name) })
      : t('plan.reset')) +
    '</button></div></details>';
  h +=
    '<footer class="credit"><p id="sync">' +
    syncText() +
    '</p><p>' +
    t('credits') +
    '</p>' +
    byline() +
    '</footer>';
  const root = must('#tab-plan');
  const wasOpen = $$('details', root, HTMLDetailsElement).map((d) => d.open),
    sameDay = root.dataset.day === String(day);
  root.innerHTML = h;
  root.dataset.day = String(day);
  if (sameDay)
    $$('details', root, HTMLDetailsElement).forEach((d, i) => {
      if (wasOpen[i]) d.open = true;
    });
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
  must('#markDone', root).onclick = () => {
    setDayComplete(day, !state.done[day]);
    renderPlan();
  };
  $$('[data-toggle-day]', root).forEach(
    (b) =>
      (b.onclick = () => {
        const dn = Number(b.dataset.toggleDay);
        setDayComplete(dn, !state.done[dn]);
        renderPlan();
      }),
  );
  const startDate = must('#startDate', root, HTMLInputElement);
  startDate.onchange = () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate.value)) {
      setStartDate(startDate.value);
      renderPlan();
    }
  };
  must('#resetBtn', root).onclick = () => {
    if (!ui.resetArmed) {
      ui.resetArmed = true;
      renderPlan();
      setTimeout(() => {
        if (ui.resetArmed) {
          ui.resetArmed = false;
          if (ui.currentTab === 'plan') renderPlan();
        }
      }, 4000);
      return;
    }
    ui.resetArmed = false;
    resetProgress();
    renderAll();
  };
}
