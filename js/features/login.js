import { showTab } from '../core/nav.js';
import { goalOf } from '../core/plan.js';
import { renderAll } from '../core/render-all.js';
import {
  COLORS,
  ISO,
  addStudent,
  clearCurrentStudent,
  loadProgress,
  me,
  normalize,
  selectStudent,
  setDeviceLanguage,
  students,
} from '../core/store.js';
import { canStore } from '../core/storage.js';
import { reconcileLessonCompletion } from '../core/lesson.js';
import { ui } from '../core/ui-state.js';
import { ALL } from '../data/letters.js';
import { checkBadges } from './gamify.js';
import { deviceLang, langChip, langStep, setLang } from './language.js';
import {
  ageOpts,
  goalHint,
  jlOpts,
  minOpts,
  paceOpts,
  reasonOpts,
  sel,
} from '../ui/profile-fields.js';
import { applyStudent, deviceTheme } from '../ui/appearance.js';
import { avatar, cleanName, nameTaken, swatches } from '../ui/student.js';
import { LANG, t } from '../i18n/core.js';
import { fmt } from '../i18n/helpers.js';
import { closeSheet } from '../ui/sheet-state.js';
import { reduceAnim } from '../core/motion.js';
import { $, $$, esc, isObject, isoToUTC, must, todayISO } from '../util.js';

/* ---------- students: passwordless login and profile ---------- */
/** @returns {string} */
function newId() {
  try {
    if (window.crypto && crypto.randomUUID)
      return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  } catch (e) {}
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
/** @param {import('../../types/app').Progress} s */
function planDay(s) {
  return Math.floor((isoToUTC(todayISO()) - isoToUTC(s.start)) / 86400000) + 1;
}
/**
 * Checks that a parsed file is a student export from this app.
 * @param {unknown} d
 * @returns {{student: import('../../types/app').RawStudent, progress: unknown} | null}
 */
function readExport(d) {
  if (!isObject(d) || d.app !== 'hiragana14' || !d.progress) return null;
  const student = d.student;
  if (!isObject(student) || typeof student.name !== 'string') return null;
  return { student: { ...student, id: '', name: student.name }, progress: d.progress };
}
/** One line about a student's place in the plan. @param {import('../../types/app').Progress} s @param {import('../../types/app').Student} sp */
function summaryOf(s, sp) {
  const n = planDay(s),
    solid = ALL.filter((k) => (s.stats[k]?.b ?? 0) >= 4).length;
  return t('summary', {
    day:
      n < 1
        ? t('plan.starts', { date: fmt(s.start) })
        : n > goalOf(sp).pace
          ? t('plan.complete')
          : t('plan.dayOf', { n, total: goalOf(sp).pace }),
    s: solid,
  });
}
/** The student picker and new-student form. */
export function showLogin() {
  closeSheet('silent');
  ui.navStack = [];
  setLang(deviceLang());
  const bb = $('#backBar');
  if (bb) bb.hidden = true;
  document.body.classList.add('signed-out');
  document.body.classList.remove('kid');
  $$('.tab').forEach((s) => {
    s.hidden = true;
  });
  const who = must('#whoBtn');
  who.hidden = true;
  who.innerHTML = '';
  const root = must('#login');
  root.hidden = false;
  /* the first step: choose a language, before anything else is asked */
  if (ui.langStep || (!students.lang && !students.list.length)) {
    root.innerHTML = langStep(LANG);
    $$('[data-lang]', root).forEach(
      (b) =>
        (b.onclick = () => {
          setDeviceLanguage(b.dataset.lang);
          ui.langStep = false;
          /* the step fades away, then the form rises in */
          const step = $('.langstep', root);
          const next = () => {
            showLogin();
            window.scrollTo(0, 0);
          };
          if (step && !reduceAnim()) {
            step.classList.add('leaving');
            setTimeout(next, 220);
          } else next();
        }),
    );
    return;
  }
  const list = students.list.slice().sort((x, y) => (y.last || 0) - (x.last || 0));
  let h = langChip(LANG);
  h += '<h2>' + t(list.length ? 'login.who' : 'login.create') + '</h2>';
  h += '<p class="muted">' + t(list.length ? 'login.tapName' : 'login.addName') + '</p>';
  if (!canStore) h += '<p class="note warn">' + t('login.blocked') + '</p>';
  if (ui.loginMsg) h += '<p class="fmsg" role="alert">' + esc(t(ui.loginMsg)) + '</p>';
  if (list.length)
    h +=
      '<div class="students">' +
      list
        .map(
          (p) =>
            '<button class="student" data-login="' +
            esc(p.id) +
            '"' +
            (p.lang ? ' lang="' + p.lang + '"' : '') +
            '>' +
            avatar(p) +
            '<span class="sn"><b dir="auto">' +
            esc(p.name) +
            '</b><span class="muted small">' +
            summaryOf(normalize(loadProgress(p.id)), p) +
            '</span></span></button>',
        )
        .join('') +
      '</div>';
  h +=
    (list.length ? '<h3>' + t('login.add') + '</h3>' : '') +
    '<form id="newStudent" class="sform" novalidate autocomplete="off">';
  h +=
    '<label class="field"><span class="small muted">' +
    t('f.name') +
    '</span><input id="nsName" maxlength="24" dir="auto" autocapitalize="words" spellcheck="false"></label>';
  h += swatches('nsColor', COLORS[list.length % COLORS.length]);
  h +=
    '<label class="field"><span class="small muted">' +
    t('f.start') +
    '</span><input type="date" id="nsStart" value="' +
    todayISO() +
    '"></label>';
  h +=
    '<div class="fgrid">' +
    sel('nsAge', ageOpts(), 'adult', t('f.age')) +
    sel('nsJl', jlOpts(), 'new', t('f.jlevel')) +
    sel('nsPace', paceOpts(), 14, t('f.pace')) +
    sel('nsMin', minOpts(), 30, t('f.min')) +
    sel('nsReason', reasonOpts(), 'jlpt', t('f.reason'), goalHint('jlpt')) +
    '</div>';
  h += '<p class="fmsg" id="nsMsg" role="alert"></p>';
  h +=
    '<div class="btnrow"><button class="btn primary" type="submit">' +
    t('login.createBtn') +
    '</button></div></form>';
  h +=
    '<p class="small imp"><button class="link" id="importBtn" type="button">' +
    t('login.import') +
    '</button><span class="muted">' +
    t('login.importHint') +
    '</span></p><input type="file" id="importFile" accept="application/json,.json" hidden>';
  h += '<footer class="credit"><p>' + t('credits') + '</p></footer>';
  root.innerHTML = h;
  ui.loginMsg = '';
  must('[data-change-lang]', root).onclick = () => {
    ui.langStep = true;
    showLogin();
  };
  $$('[data-login]', root).forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.login) login(b.dataset.login);
      }),
  );
  const nameInput = must('#nsName', root, HTMLInputElement);
  const levelSelect = must('#nsJl', root, HTMLSelectElement);
  const paceSelect = must('#nsPace', root, HTMLSelectElement);
  must('#newStudent', root).onsubmit = (e) => {
    e.preventDefault();
    const name = cleanName(nameInput.value),
      msg = must('#nsMsg', root);
    const color = $('input[name="nsColor"]:checked', root, HTMLInputElement)?.value || COLORS[0];
    const start = must('#nsStart', root, HTMLInputElement).value;
    if (!name) {
      msg.textContent = t('err.noName');
      nameInput.focus();
      return;
    }
    if (nameTaken(name)) {
      msg.textContent = t('err.taken', { name });
      nameInput.focus();
      return;
    }
    const age = must('#nsAge', root, HTMLSelectElement).value;
    const p = {
      id: newId(),
      name,
      color,
      created: todayISO(),
      last: Date.now(),
      lang: LANG,
      age,
      jlevel: levelSelect.value,
      native: LANG,
      rate: age === 'child' ? 0.75 : 1,
      goal: {
        pace: Number(paceSelect.value),
        min: Number(must('#nsMin', root, HTMLSelectElement).value),
        reason: must('#nsReason', root, HTMLSelectElement).value,
      },
      av: { t: 'initial', k: 'あ', img: '' },
      theme: deviceTheme(),
    };
    addStudent(p, { start: ISO.test(start) ? start : todayISO() });
    enterApp();
  };
  levelSelect.onchange = () => {
    if (levelSelect.value === 'all') paceSelect.value = '7';
  };
  const importFile = must('#importFile', root, HTMLInputElement);
  must('#importBtn', root).onclick = () => importFile.click();
  importFile.onchange = async () => {
    const f = importFile.files && importFile.files[0];
    if (!f) return;
    try {
      if (f.size > 2e6) throw new Error('too big');
      const d = readExport(JSON.parse(await f.text()));
      if (!d) throw new Error('not ours');
      const base = cleanName(d.student.name) || 'Student';
      let name = base,
        i = 2;
      while (nameTaken(name)) name = base.slice(0, 19) + ' (' + i++ + ')';
      addStudent(
        { ...d.student, id: newId(), name, last: Date.now(), lang: d.student.lang || LANG },
        d.progress,
      );
      enterApp();
    } catch (err) {
      ui.loginMsg = 'err.badFile';
      showLogin();
    }
  };
  const first = $('[data-login]', root) || nameInput;
  if (first && !matchMedia('(pointer: coarse)').matches) first.focus();
}
/** @param {string} id */
export function login(id) {
  const p = selectStudent(id);
  if (!p) return showLogin();
  enterApp();
}
export function renderWho() {
  const p = me(),
    b = must('#whoBtn');
  if (!p) {
    b.hidden = true;
    return;
  }
  b.innerHTML = avatar(p) + '<span class="nm" dir="auto">' + esc(p.name) + '</span>';
  b.setAttribute('aria-label', t('p.label', { name: p.name }));
  b.hidden = false;
}
function enterApp() {
  const student = me();
  if (!student) return showLogin();
  setLang(student.lang || deviceLang());
  document.body.classList.remove('signed-out');
  const root = must('#login');
  root.hidden = true;
  root.innerHTML = '';
  ui.session = null;
  ui.wq = null;
  ui.demoShown = false;
  ui.resetArmed = false;
  ui.drillSel = new Set(['today']);
  ui.chartView = 'basic';
  renderWho();
  applyStudent();
  const kid = student.age === 'child';
  ui.drillLen = kid ? 10 : goalOf().min === 10 ? 10 : 20;
  ui.showRo = kid;
  ui.lastLevel = 0;
  reconcileLessonCompletion();
  checkBadges(true);
  ui.currentTab = 'plan';
  renderAll();
  showTab(location.hash.slice(1), { initial: true });
}
export function switchStudent() {
  clearCurrentStudent();
  ui.session = null;
  ui.wq = null;
  showLogin();
}
