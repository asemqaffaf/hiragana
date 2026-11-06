import { bindSay, hasClip, speakFull } from '../core/audio.js';
import { reduceAnim } from '../core/motion.js';
import { showTab } from '../core/nav.js';
import { nextPracticeStep } from '../core/practice.js';
import { me, state } from '../core/store.js';
import {
  CLEAN_GOAL,
  canComplete,
  completeLetter,
  isComplete,
  recordWrite,
  writingStats,
} from '../core/progress.js';
import { ui } from '../core/ui-state.js';
import { rom } from '../data/letters.js';
import { WGROUPS, groupOf } from '../data/writing.js';
import { canOpenLessonWriting, lessonWritingSequence, nextLessonStep, nextWritingKana, recordLessonWrite, resumeWritingKana, revokeLessonWriting, saveLessonWriting, writeList } from '../core/lesson.js';
import { runStep } from './lesson.js';
import { curDay } from '../core/plan.js';
import { WRITING_PASSES, advanceWritingStage, passWritingStage, selectWritingStage, writingSequenceComplete } from '../core/writing-sequence.js';
import { t } from '../i18n/core.js';
import { judgeStroke, strokeCount, strokeMessage, strokeTemplates } from '../strokes/check.js';
import { strokeSVG } from '../strokes/draw.js';
import { letterNotesHtml } from '../ui/letter-notes.js';
import { bindPracticeNext } from '../ui/practice-next.js';
import { $, $$, MARK_SVG, SPEAK_SVG, must } from '../util.js';

/* ---------- write ---------- */
/** The completed tag, or what is still needed to complete the letter. @param {string} k */
function completeHtml(k) {
  if (isComplete(k))
    return (
      '<span class="tag done">' +
      t('cl.done') +
      '</span><button class="link" id="wUncomplete" type="button">' +
      t('cl.undo') +
      '</button>'
    );
  const heard = (state.heard[k] || 0) > 0,
    p = wsOf(k).p;
  return (
    '<span class="cl-need small muted">' +
    t('cl.need', {
      heard: heard ? t('cl.ok') : t('cl.todo'),
      p: Math.min(p, CLEAN_GOAL),
      g: CLEAN_GOAL,
    }) +
    '</span>'
  );
}
function refreshComplete() {
  const box = $('#wComplete'),
    k = ui.writeK;
  if (!box) return;
  box.innerHTML = completeHtml(k);
  const u = $('#wUncomplete');
  if (u)
    u.onclick = () => {
      completeLetter(k, false);
      refreshComplete();
      markStrip(k);
    };
  const btn = $('#wCompleteBtn');
  if (btn) {
    const next = $('.practice-continue-slot [data-practice-next]');
    const activity = nextPracticeStep('write');
    const ready = canComplete(k);
    btn.hidden = !ready;
    btn.textContent = next && activity
      ? t('write.completeContinue', { k, activity: t(`tab.${activity}`) })
      : t('cl.btn', { k });
    if (next) next.hidden = ready;
  }
}
/** @param {string} k */
function markStrip(k) {
  const b = $('.strip [data-wk="' + k + '"]');
  if (b) b.classList.toggle('cl', isComplete(k));
  const bar = b && $('.wm', b);
  if (bar) bar.style.setProperty('--m', String(writeProgress(k)));
}
const wsOf = writingStats;
/** @param {string} k */
const writeProgress = (k) => ui.lessonWrite
  ? lessonWritingSequence(k).completed / WRITING_PASSES.length
  : Math.min(wsOf(k).p, CLEAN_GOAL) / CLEAN_GOAL;
/** @type {readonly import('../../types/app').TextKey[]} */
const STAGE_LABELS = ['write.stageGuide', 'write.stageNumbers', 'write.stageMemory'];
const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
function closeWritingHelp() {
  const help = $('#wStageHelp');
  if (help?.matches(':popover-open')) help.hidePopover();
}
/** @param {HTMLElement} button @param {number} index */
function showWritingHelp(button, index) {
  const sequence = ui.lessonWritingSequence;
  if (!sequence) return;
  showWritingMessage(button, t('write.unlockStep', {
    previous: STAGE_LABELS.slice(sequence.completed, index).map((label) => t(label)).join(' ' + t('write.stepThen') + ' '),
    next: t(STAGE_LABELS[index]),
  }));
}
/** @param {HTMLElement} button @param {string} message */
function showWritingMessage(button, message) {
  const help = $('#wStageHelp');
  if (!help) return;
  must('#wStageHelpText', help).textContent = message;
  help.showPopover();
  const r = button.getBoundingClientRect(), box = help.getBoundingClientRect();
  help.style.left = Math.max(16, Math.min(innerWidth - box.width - 16, r.x + r.width / 2 - box.width / 2)) + 'px';
  help.style.top = (r.bottom + box.height + 16 < innerHeight ? r.bottom + 8 : Math.max(16, r.top - box.height - 8)) + 'px';
}
function refreshWritingStages() {
  const sequence = ui.lessonWrite ? ui.lessonWritingSequence : null;
  if (!sequence) return;
  $$('#wStages [data-writing-stage]').forEach((button) => {
    const index = Number(button.dataset.writingStage), locked = index > sequence.completed;
    button.setAttribute('aria-disabled', String(locked));
    if (index === sequence.index) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
    button.setAttribute('aria-label', t('write.passProgress', { i: index + 1, n: WRITING_PASSES.length, label: t(WRITING_PASSES[index].label) }) +
      (locked ? '. ' + t('write.lockedStep') : index < sequence.completed ? '. ' + t('cl.done') : ''));
    const lock = $('.wstage-lock', button);
    if (lock) lock.hidden = !locked;
  });
}
/** @param {string} k */
function cleanText(k) {
  return t('clean', { p: wsOf(k).p });
}
/** The letter after the current one, moving on to the next group at the end. */
function nextWrite() {
  const g = WGROUPS.find((x) => x.id === ui.writeGroup) || WGROUPS[0],
    i = g.kana.indexOf(ui.writeK);
  if (i >= 0 && i < g.kana.length - 1) return { k: g.kana[i + 1], g: g.id };
  const ng = WGROUPS[(WGROUPS.indexOf(g) + 1) % WGROUPS.length];
  return { k: ng.kana[0], g: ng.id };
}
/** @returns {import('../../types/app').WriteAttempt} */
function newAttempt() {
  return {
    k: ui.writeK,
    tpl: strokeTemplates(ui.writeK),
    i: 0,
    miss: 0,
    sm: 0,
    done: false,
    recorded: false,
  };
}
/** Shows a message under the writing area. @param {string} text @param {'good' | 'bad'} [cls] */
function wSay(text, cls) {
  const el = $('#wStat');
  if (!el) return;
  el.textContent = text;
  el.className = 'wstat' + (cls ? ' ' + cls : '');
}
/** @param {import('../../types/app').WriteAttempt} wq */
function startText(wq) {
  return t('w.start', { n: wq.tpl ? wq.tpl.pts.length : 0, nums: ui.writeNums });
}
/** @param {boolean} on */
function setMark(on) {
  const m = $('#wsq .mark');
  if (m) m.setAttribute('class', 'mark' + (on ? ' ok' : ''));
  $('#wsq')?.classList.toggle('write-success', on);
}
/* The bar under the writing area. Writing a lesson's letters: it is always there, Next waits (dimmed) until the letter is written.
   Free writing: it appears once the letter is written. */
/** @param {boolean} on @param {boolean} [fresh] Whether this is a newly completed write. */
function showDone(on, fresh = true) {
  const dn = $('#wDone');
  if (!dn) return;
  dn.hidden = !on && !ui.lessonWrite;
  dn.classList.toggle('waiting', !on);
  const nx = $('#wNext', dn, HTMLButtonElement),
    again = $('#wAgain', dn);
  if (nx) {
    const sequence = ui.lessonWrite ? ui.lessonWritingSequence : null;
    nx.disabled = !on || !!(sequence && !sequence.passed);
    nx.setAttribute('aria-disabled', String(nx.disabled));
    nx.classList.toggle('next-ready', fresh && !!sequence && !nx.disabled);
  }
  if (again) again.hidden = !on;
  /* the writing area sits above this bar, so on a short phone it can be off screen when the letter is finished */
  if (on && fresh && !reduceAnim()) dn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  else if (on && fresh) dn.scrollIntoView({ block: 'nearest' });
}
/** The number of strokes in the letter being written. @param {import('../../types/app').WriteAttempt} wq */
const strokeTotal = (wq) => (wq.tpl ? wq.tpl.pts.length : 0);
function restartAttempt() {
  const wq = (ui.wq = newAttempt());
  ui.demoShown = false;
  if (ui.writeSvg) {
    ui.writeSvg.clearHint();
    ui.writeSvg.showUpTo(0);
  }
  if (ui.pad) ui.pad.clear();
  setMark(false);
  showDone(false);
  wSay(startText(wq));
}
function finishWrite() {
  const wq = ui.wq;
  if (!wq) return;
  const n = strokeTotal(wq);
  wq.done = true;
  if (!wq.recorded) {
    wq.recorded = true;
    recordWrite(wq.k, !wq.miss);
  }
  const sequence = ui.lessonWrite ? ui.lessonWritingSequence : null;
  if (sequence) {
    passWritingStage(sequence, !wq.miss);
    if (!wq.miss) saveLessonWriting(sequence);
    closeWritingHelp();
    refreshWritingStages();
  }
  if (!wq.miss) {
    setMark(true);
    wSay(sequence
      ? t('write.passDone', { i: sequence.index + 1, n: WRITING_PASSES.length })
      : t('w.allRight', { n, clean: cleanText(wq.k) }), 'good');
  } else wSay(t('w.finished', { m: wq.miss }), 'bad');
  const c = $('#wCount');
  if (c) c.textContent = cleanText(wq.k);
  const bar = $('.strip [data-wk="' + wq.k + '"] .wm');
  if (bar) bar.style.setProperty('--m', String(writeProgress(wq.k)));
  showDone(true);
  refreshComplete();
  if (!sequence && canComplete(wq.k)) wSay(t('cl.ready', { k: wq.k }), 'good');
  else if (!sequence && !isComplete(wq.k) && !((state.heard[wq.k] ?? 0) > 0) && wsOf(wq.k).p >= CLEAN_GOAL)
    wSay(t('cl.listen'), 'good');
}
/** @type {import('../../types/app').PadHandler} */
const writeHandler = {
  begin() {
    if (!ui.wq || !ui.writeSvg) return;
    if (ui.wq.done) restartAttempt();
    else if (ui.demoShown) {
      ui.demoShown = false;
      ui.writeSvg.showUpTo(ui.wq.i);
    }
    ui.writeSvg?.clearHint();
  },
  end(pts) {
    const wq = ui.wq;
    if (!wq || !wq.tpl) return 'ignore';
    const n = wq.tpl.pts.length,
      i = wq.i;
    const v = judgeStroke(
      pts,
      wq.tpl,
      i,
      (ui.writeGuide ? 1 : 1.35) * (me()?.age === 'child' ? 1.2 : 1),
    );
    if (v.kind === 'tiny') {
      wSay(strokeMessage(v, i, ui.writeNums), 'bad');
      return 'ignore';
    }
    if (v.kind === 'ok') {
      wq.i++;
      wq.sm = 0;
      ui.writeSvg?.showUpTo(wq.i);
      if (wq.i >= n) finishWrite();
      else wSay(t('w.right', { i: i + 1, j: i + 2, n }), 'good');
      return 'ok';
    }
    wq.miss++;
    wq.sm++;
    const sequence = ui.lessonWrite ? ui.lessonWritingSequence : null;
    const revoked = !!sequence && (sequence.passed || sequence.completed > sequence.index);
    if (sequence) {
      revokeLessonWriting(sequence);
      closeWritingHelp();
      refreshWritingStages();
      markStrip(wq.k);
      setMark(false);
      showDone(false);
    }
    wSay(strokeMessage(v, i, ui.writeNums) + (revoked ? ' ' + t('write.passRevoked') : ''), 'bad');
    if (v.kind === 'shape' || wq.sm >= 2) ui.writeSvg?.hint(i);
    return 'bad';
  },
};
const ICON = {
  guide: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3-7 9-7 9 7 9 7-3 7-9 7-9-7-9-7Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  numbers: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m8 9 2-1v8m-2 0h4m3-6h2m-2 4h2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m7.5 12 3 3 6-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
  hint: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  undo: '<svg class="mir" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5L4.5 11 9 15.5M5 11h9.5a5 5 0 0 1 0 10H12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  restart:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 3.5V8H9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  clear:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};
/** A button in the row of tools. @param {string} id @param {string} icon @param {string} label @param {string} [cls] */
const tool = (id, icon, label, cls) =>
  '<button class="tool' +
  (cls ? ' ' + cls : '') +
  '" id="' +
  id +
  '" type="button">' +
  icon +
  '<span dir="auto">' +
  label +
  '</span></button>';
/** @param {boolean} [play] start the stroke-order demo straight away */
export function renderWrite(play) {
  closeWritingHelp();
  const root = must('#tab-write');
  if (ui.lessonWrite && !canOpenLessonWriting(ui.writeK)) {
    ui.writeK = resumeWritingKana();
    ui.writeGroup = groupOf(ui.writeK);
    ui.lessonWritingSequence = null;
  }
  const g = WGROUPS.find((x) => x.id === ui.writeGroup) || WGROUPS[0];
  if (!g.kana.includes(ui.writeK)) ui.writeK = g.kana[0];
  if (ui.lessonWrite) {
    const previous = ui.lessonWritingSequence;
    const studentId = me()?.id || '';
    const active = !previous || previous.k !== ui.writeK || previous.studentId !== studentId || previous.day !== curDay()
      ? lessonWritingSequence(ui.writeK)
      : previous;
    ui.lessonWritingSequence = active;
    const pass = WRITING_PASSES[active.index];
    ui.writeGuide = pass.guide;
    ui.writeNums = pass.numbers;
    ui.writeCheck = true;
  } else ui.lessonWritingSequence = null;
  const sequence = ui.lessonWritingSequence;
  const wl = ui.lessonWrite ? writeList() : [],
    li = wl.indexOf(ui.writeK);
  const nextKana = li >= 0 ? nextWritingKana(ui.writeK) : '';
  const n = strokeCount(ui.writeK),
    nx =
      li >= 0
        ? nextKana
          ? { k: nextKana, g: groupOf(nextKana) }
          : { k: '', g: '' }
        : nextWrite();
  const nextActivity = sequence && !nx.k ? nextLessonStep('write') : null;
  const nextActivityLabel = nextActivity ? t(nextActivity === 'words' ? 'tab.daily' : nextActivity === 'quiz' ? 'tab.drill' : 'tab.read') : '';
  let h = '<h2>' + t('tab.write') + '</h2>';
  h +=
    '<div class="strip">' +
    g.kana
      .map(
        (k) =>
          '<button class="sq' +
          (isComplete(k) ? ' cl' : '') +
          '" data-wk="' +
          k +
          '" aria-pressed="' +
          (k === ui.writeK) +
          '" aria-disabled="' +
          (!!sequence && !canOpenLessonWriting(k)) +
          '" aria-label="' +
          k +
          ', ' +
          rom(k) +
          ', ' +
          cleanText(k) +
          (isComplete(k) ? ', ' + t('cl.done') : '') +
          '"><span class="k">' +
          k +
          '</span>' + (sequence && !canOpenLessonWriting(k) ? '<span class="wletter-lock" aria-hidden="true">' + LOCK_SVG + '</span>' : '') +
          '<span class="wm" style="--m:' +
          writeProgress(k) +
          '"></span></button>',
      )
      .join('') +
    '</div>';
  if (sequence)
    h += '<p class="wpass" id="wPassProgress" role="status">' +
      t('write.passProgress', { i: sequence.index + 1, n: WRITING_PASSES.length, label: t(WRITING_PASSES[sequence.index].label) }) + '</p>' +
      '<div class="wstages" id="wStages" role="group" aria-label="' + t('write.stages') + '">' +
      STAGE_LABELS.map((label, index) =>
        '<button class="btn wstage" type="button" data-writing-stage="' + index + '"><span>' + (index + 1) + '</span><span dir="auto">' + t(label) +
        '</span><span class="wstage-lock" aria-hidden="true">' + LOCK_SVG + '</span></button>'
      ).join('') + '</div><div class="wstage-help" id="wStageHelp" popover="auto" role="status"><span id="wStageHelpText"></span><button type="button" class="wstage-help-close" popovertarget="wStageHelp" popovertargetaction="hide" aria-label="' + t('close') + '">×</button></div>';
  h += '<fieldset class="wsettings-inline" id="wOptions"' + (sequence ? ' hidden disabled' : '') + '><legend>' + t('write.settings') +
    '</legend><div class="wsettings-options"><label><input type="checkbox" role="switch" id="wGuide" aria-label="' + t('write.guide') + '"' +
    (ui.writeGuide ? ' checked' : '') + '><span class="woption-label">' + ICON.guide + '<span>' + t('write.guideShort') +
    '</span></span></label><label><input type="checkbox" role="switch" id="wNums" aria-label="' + t('write.nums') + '"' +
    (ui.writeNums ? ' checked' : '') + '><span class="woption-label">' + ICON.numbers + '<span>' + t('write.numsShort') +
    '</span></span></label><label><input type="checkbox" role="switch" id="wCheck" aria-label="' + t('write.check') + '"' +
    (ui.writeCheck ? ' checked' : '') + '><span class="woption-label">' + ICON.check + '<span>' + t('write.checkShort') +
    '</span></span></label></div></fieldset>';
  h += '<div class="wgrid"><div class="wleft">';
  h +=
    '<p class="wmeta"><b>' +
    rom(ui.writeK) +
    '</b><span class="muted small" dir="auto">' +
    t('strokes', { n: n ?? 0 }) +
    '</span>' +
    (ui.writeCheck && !sequence
      ? '<span class="muted small" id="wCount">' + cleanText(ui.writeK) + '</span>'
      : '') +
    '</p>';
  h +=
    '<div class="sq wsq" id="wsq" dir="ltr"><canvas id="wpad" aria-label="' +
    t('write.area', { k: ui.writeK }) +
    '"></canvas>' +
    MARK_SVG +
    '<span class="wcelebrate" aria-hidden="true">' +
    '<span>✦</span>'.repeat(8) +
    '</span>' +
    '</div>';
  h += '</div><div class="wright">';
  h +=
    '<p class="wstat" id="wStat" role="status" aria-live="polite">' +
    (ui.writeCheck ? '' : t('write.free')) +
    '</p>';
  h +=
    '<div class="tools">' +
    tool('wPlay', ICON.play, t('write.play'), 'primary') +
    tool('wSay', SPEAK_SVG, t('write.hear'));
  h += ui.writeCheck
    ? tool('wHint', ICON.hint, t('write.hint')) +
      tool('wUndo', ICON.undo, t('write.undo')) +
      tool('wClear', ICON.restart, t('write.restart'))
    : tool('wUndo', ICON.undo, t('write.undo')) + tool('wClear', ICON.clear, t('write.clear'));
  h += '</div>';
  const againHtml = '<button class="btn" id="wAgain" type="button" hidden>' + t('write.again') + '</button>';
  h +=
    '<div class="btnrow wdone actionbar inflow' + (sequence ? ' lesson-actions' : '') + '" id="wDone" hidden>' +
    (sequence ? '' : againHtml) +
    '<button class="btn' + (ui.lessonWrite ? ' primary' : '') + '" id="wNext" type="button" disabled aria-disabled="true"><span dir="auto">' +
    (sequence && sequence.index < WRITING_PASSES.length - 1
      ? t('write.passNext', { label: t(WRITING_PASSES[sequence.index + 1].label) })
      : sequence ? nextActivity
        ? t('write.completeContinue', { k: ui.writeK, activity: nextActivityLabel })
        : t(nx.k ? 'write.completeNext' : 'write.completeDone', { k: ui.writeK })
      : nx.k ? t('write.next') + ' <span class="kana">' + nx.k + '</span>' : t('lesson.back')) +
    '</span>' + (sequence ? '<svg class="wnext-arrow" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>' : '') +
    '</button>' + (sequence ? againHtml : '') + '</div>';
  if (!sequence) {
    if (ui.writeCheck) h += '<p class="wcomp" id="wComplete"></p>';
  }
  h += '<div class="practice-continue-slot">' +
    (sequence ? '' : '<button class="btn primary practice-next" id="wCompleteBtn" type="button" hidden></button>') +
    '</div>';
  h += '<div class="wnotes">' + letterNotesHtml(ui.writeK) + '</div>';
  h +=
    '<details class="more wtips"><summary>' +
    t('write.howTitle') +
    '</summary><p class="small">' +
    (ui.writeCheck ? t('write.howCheck') : t('write.howFree')) +
    '</p></details>';
  h += '</div></div>';
  root.innerHTML = h;
  bindSay(root);
  bindPracticeNext(root, 'write');
  refreshWritingStages();
  $$('#wStages [data-writing-stage]', root).forEach((button) => {
    button.onclick = () => {
      const index = Number(button.dataset.writingStage);
      if (sequence && index > sequence.completed) {
        showWritingHelp(button, index);
        return;
      }
      closeWritingHelp();
      if (sequence && index !== sequence.index && selectWritingStage(sequence, index)) {
        saveLessonWriting(sequence);
        renderWrite();
        $('#wStages [data-writing-stage="' + index + '"]')?.focus({ preventScroll: true });
      }
    };
  });
  showDone(false);
  const wsq = must('#wsq', root);
  ui.writeSvg = strokeSVG(ui.writeK, { guide: ui.writeGuide, nums: ui.writeNums, inkHidden: true });
  if (ui.writeSvg) wsq.insertBefore(ui.writeSvg, wsq.firstChild);
  const wq = (ui.wq = ui.writeCheck ? newAttempt() : null);
  ui.demoShown = false;
  ui.pad = makePad(
    must('#wpad', root, HTMLCanvasElement),
    ui.writeCheck && wq && wq.tpl ? writeHandler : null,
  );
  if (ui.writeCheck && wq) wSay(startText(wq));
  $$('[data-wk]', root).forEach(
    (b) =>
      (b.onclick = () => {
        if (ui.lessonWrite && !canOpenLessonWriting(b.dataset.wk || '')) {
          showWritingMessage(b, t('write.unlockLetter', { k: resumeWritingKana() }));
          return;
        }
        if (ui.lessonWrite && !wl.includes(b.dataset.wk || '')) ui.lessonWrite = false;
        ui.writeK = b.dataset.wk || ui.writeK;
        if (ui.lessonWrite) saveLessonWriting(lessonWritingSequence(ui.writeK));
        renderWrite(true);
      }),
  );
  const guide = must('#wGuide', root, HTMLInputElement);
  guide.onchange = () => {
    ui.writeGuide = guide.checked;
    if (ui.writeSvg) ui.writeSvg.classList.toggle('no-guide', !ui.writeGuide);
  };
  const nums = must('#wNums', root, HTMLInputElement);
  nums.onchange = () => {
    ui.writeNums = nums.checked;
    if (ui.writeSvg) ui.writeSvg.classList.toggle('no-num', !ui.writeNums);
  };
  const check = must('#wCheck', root, HTMLInputElement);
  check.onchange = () => {
    ui.writeCheck = check.checked;
    renderWrite();
    must('#wCheck', root).focus({ preventScroll: true });
  };
  must('#wPlay', root).onclick = () => {
    if (ui.pad) ui.pad.clear();
    if (ui.writeCheck && ui.wq) {
      restartAttempt();
      ui.demoShown = true;
      wSay(t('w.watch', { n: ui.wq ? strokeTotal(ui.wq) : 0 }));
    }
    if (ui.writeSvg) ui.writeSvg.play();
  };
  const ws = must('#wSay', root, HTMLButtonElement);
  if (!hasClip(ui.writeK)) {
    ws.disabled = true;
    ws.title = t('write.silent');
  } else
    ws.onclick = () => {
      speakFull(ui.writeK);
      refreshComplete();
      if (!sequence && ui.wq && ui.wq.done && canComplete(ui.writeK))
        wSay(t('cl.ready', { k: ui.writeK }), 'good');
    };
  const hb = $('#wHint', root);
  if (hb)
    hb.onclick = () => {
      if (ui.wq && !ui.wq.done && ui.writeSvg) {
        if (ui.demoShown) {
          ui.demoShown = false;
          ui.writeSvg.showUpTo(ui.wq.i);
        }
        ui.writeSvg.hint(ui.wq.i);
      }
    };
  must('#wUndo', root).onclick = () => {
    const attempt = ui.wq;
    if (!ui.writeCheck || !attempt) {
      if (ui.pad) ui.pad.undo();
      return;
    }
    if (attempt.done) {
      attempt.done = false;
      attempt.i = strokeTotal(attempt) - 1;
      setMark(false);
      showDone(false);
    } else if (attempt.i > 0) attempt.i--;
    attempt.sm = 0;
    ui.demoShown = false;
    if (ui.pad) ui.pad.clear();
    ui.writeSvg?.clearHint();
    ui.writeSvg?.showUpTo(attempt.i);
    wSay(t('w.draw', { i: attempt.i + 1, n: strokeTotal(attempt) }));
  };
  must('#wClear', root).onclick = () => {
    if (!ui.writeCheck || !ui.wq) {
      if (ui.pad) ui.pad.clear();
      if (ui.writeSvg) ui.writeSvg.showInk(false);
      return;
    }
    restartAttempt();
  };
  must('#wAgain', root).onclick = () => restartAttempt();
  const cb = $('#wCompleteBtn', root);
  if (cb)
    cb.onclick = () => {
      completeLetter(ui.writeK, true);
      cb.hidden = true;
      refreshComplete();
      markStrip(ui.writeK);
      wSay(t('cl.saved', { k: ui.writeK }), 'good');
      $('.practice-continue-slot [data-practice-next]', root)?.click();
    };
  if (ui.writeCheck) refreshComplete();
  must('#wNext', root).onclick = () => {
    if (sequence && !writingSequenceComplete(sequence)) {
      if (advanceWritingStage(sequence)) {
        saveLessonWriting(sequence);
        renderWrite();
      }
      return;
    }
    if (sequence) {
      // The combined action saves both kinds of completion before moving on.
      // If introductions were skipped, play the letter to meet the listening requirement.
      if (!isComplete(ui.writeK) && !((state.heard[ui.writeK] ?? 0) > 0)) speakFull(ui.writeK);
      completeLetter(ui.writeK, true);
      if (!isComplete(ui.writeK)) {
        wSay(t('cl.listen'), 'good');
        return;
      }
      recordLessonWrite(ui.writeK);
    }
    if (!nx.k) {
      ui.lessonWrite = false;
      const next = sequence ? nextLessonStep('write') : null;
      if (next) runStep(next);
      else showTab('plan');
      return;
    }
    ui.writeGroup = nx.g;
    ui.writeK = nx.k;
    if (ui.lessonWrite) saveLessonWriting(lessonWritingSequence(ui.writeK));
    renderWrite(!ui.lessonWrite);
  };
  if (sequence?.passed && ui.wq) {
    ui.wq.done = true;
    ui.wq.recorded = true;
    ui.wq.i = strokeTotal(ui.wq);
    ui.writeSvg?.showUpTo(ui.wq.i);
    setMark(false);
    wSay(t('write.passDone', { i: sequence.index + 1, n: WRITING_PASSES.length }), 'good');
    showDone(true, false);
  }
  if (play && ui.writeSvg) {
    ui.demoShown = !!ui.wq;
    if (ui.wq) wSay(t('w.watch', { n: strokeTotal(ui.wq) }));
    ui.writeSvg.play();
  }
}
/** @param {HTMLCanvasElement} canvas @returns {CanvasRenderingContext2D} */
function context2d(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw on a canvas');
  return ctx;
}
/**
 * @typedef {object} PadStroke
 * @property {import('../../types/app').StrokePath} pts
 * @property {string} c the CSS variable holding its colour
 * @property {boolean} [bad] drawn wrongly, so it fades out
 */
/**
 * The drawing surface: ink follows the pointer, and each finished stroke goes to the handler to be judged.
 * @param {HTMLCanvasElement} canvas
 * @param {import('../../types/app').PadHandler | null} handler
 * @returns {import('../../types/app').WritePad}
 */
function makePad(canvas, handler) {
  const ctx = context2d(canvas);
  /** @type {PadStroke[]} */
  let strokes = [];
  /** @type {PadStroke | null} */
  let cur = null;
  /** The pointer that is drawing, if any. @type {number | null} */
  let active = null;
  let w = 0,
    h = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let fadeT = null;
  /** @param {string} v */
  const color = (v) =>
    getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#262422';
  /** @param {string} c */
  function setStyle(c) {
    ctx.lineWidth = Math.max(4, w * 0.034);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color(c);
  }
  function size() {
    const r = canvas.getBoundingClientRect(),
      dpr = window.devicePixelRatio || 1;
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }
  /** @param {import('../../types/app').Point} a @param {import('../../types/app').Point} b */
  function seg(a, b) {
    ctx.beginPath();
    ctx.moveTo(a[0] * w, a[1] * h);
    ctx.lineTo(b[0] * w + (a === b ? 0.1 : 0), b[1] * h);
    ctx.stroke();
  }
  /** @param {PadStroke} s */
  function drawStroke(s) {
    setStyle(s.c);
    seg(s.pts[0], s.pts[0]);
    for (let i = 1; i < s.pts.length; i++) seg(s.pts[i - 1], s.pts[i]);
  }
  function redraw() {
    ctx.clearRect(0, 0, w, h);
    strokes.forEach(drawStroke);
  }
  /** @param {PointerEvent} e @returns {import('../../types/app').Point} */
  function pt(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }
  function stopFade() {
    if (fadeT) {
      clearTimeout(fadeT);
      fadeT = null;
    }
    canvas.style.opacity = '';
    strokes = strokes.filter((s) => !s.bad);
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (active !== null) return;
    e.preventDefault();
    stopFade();
    redraw();
    active = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (x) {}
    if (handler) handler.begin();
    const stroke = (cur = { pts: [pt(e)], c: '--ink' });
    strokes.push(stroke);
    setStyle(stroke.c);
    seg(stroke.pts[0], stroke.pts[0]);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== active || !cur) return;
    e.preventDefault();
    const stroke = cur;
    const evs =
      e.getCoalescedEvents && e.getCoalescedEvents().length ? e.getCoalescedEvents() : [e];
    setStyle(stroke.c);
    evs.forEach((ev) => {
      const p = pt(ev),
        last = stroke.pts[stroke.pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.002) return;
      stroke.pts.push(p);
      seg(last, p);
    });
  });
  /** @param {PointerEvent} e */
  function end(e) {
    if (e.pointerId !== active) return;
    active = null;
    const s = cur;
    cur = null;
    if (!s || !handler) return;
    const v = handler.end(s.pts);
    if (v === 'bad') {
      s.c = '--red';
      s.bad = true;
      redraw();
      fadeT = setTimeout(() => {
        canvas.style.opacity = '0';
        fadeT = setTimeout(() => {
          strokes = strokes.filter((x) => x !== s);
          redraw();
          canvas.style.opacity = '';
          fadeT = null;
        }, 280);
      }, 800);
    } else {
      strokes = strokes.filter((x) => x !== s);
      redraw();
    }
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== active) return;
    active = null;
    strokes = strokes.filter((x) => x !== cur);
    cur = null;
    redraw();
  });
  canvas.addEventListener('pointerleave', (e) => {
    if (
      e.pointerId === active &&
      !(canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId))
    )
      end(e);
  });
  if (ui.padObserver) ui.padObserver.disconnect();
  if (window.ResizeObserver) {
    ui.padObserver = new ResizeObserver(size);
    ui.padObserver.observe(canvas);
  } else window.onresize = size;
  size();
  return {
    clear() {
      stopFade();
      strokes = [];
      redraw();
    },
    undo() {
      strokes.pop();
      redraw();
    },
    redraw,
  };
}
