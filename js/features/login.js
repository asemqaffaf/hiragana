import { showTab } from '../core/nav.js';
import { recoverCloud, signInCloud, syncOn } from '../core/cloud.js';
import { hasPassword, setPassword, verifyPassword } from '../core/passwords.js';
import { goalOf } from '../core/plan.js';
import { renderAll } from '../core/render-all.js';
import {
  COLORS,
  ISO,
  addStudent,
  clearCurrentStudent,
  me,
  restoreStudent,
  selectStudent,
  setDeviceLanguage,
  students,
} from '../core/store.js';
import { canStore } from '../core/storage.js';
import { reconcileLessonCompletion } from '../core/lesson.js';
import { ui } from '../core/ui-state.js';
import { checkBadges } from './gamify.js';
import { byline, deviceLang, langChip, langStep, setLang } from './language.js';
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
import { cloudDeleteNote, renderCloudSummary } from '../ui/cloud-sync.js';
import { LANG, t } from '../i18n/core.js';
import { closeSheet } from '../ui/sheet-state.js';
import { $, $$, esc, isObject, must, todayISO } from '../util.js';

/* ---------- student sign-in and profile creation ---------- */
/** @type {string | null} */
let selectedLogin = null;
/** Which screen is showing: the first choice, signing in, or creating a profile. @type {'choose' | 'in' | 'new' | null} */
let loginMode = null;
/** @param {string} prefix @param {boolean} create */
function passwordFields(prefix, create) {
  return '<label class="field"><span class="small muted">' + t(create ? 'auth.newPassword' : 'auth.password') +
    '</span><input type="password" id="' + prefix + 'Password" maxlength="256" autocomplete="' +
    (create ? 'new-password' : 'current-password') + '" required></label>' +
    (create ? '<label class="field"><span class="small muted">' + t('auth.confirm') +
    '</span><input type="password" id="' + prefix + 'Confirm" maxlength="256" autocomplete="new-password" required></label>' : '');
}
/** @param {string} prefix @param {ParentNode} root */
function newPassword(prefix, root) {
  const password = must('#' + prefix + 'Password', root, HTMLInputElement).value;
  if (password.length < 10 || password.length > 256) throw new Error(t('auth.length'));
  if (password !== must('#' + prefix + 'Confirm', root, HTMLInputElement).value) throw new Error(t('auth.mismatch'));
  return password;
}
/** @returns {string} */
function newId() {
  try {
    if (window.crypto && crypto.randomUUID)
      return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  } catch (e) {}
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
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
/** The student picker and new-student form. */
export function showLogin() {
  renderCloudSummary(null);
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
          showLogin();
          window.scrollTo(0, 0);
        }),
    );
    return;
  }
  const list = students.list.slice().sort((x, y) => (y.last || 0) - (x.last || 0));
  let h = langChip(LANG);
  const mode = loginMode || (list.length ? 'in' : syncOn ? 'choose' : 'new');
  h += '<h2>' + t(mode === 'choose' ? 'login.welcome' : mode === 'new' ? 'login.create' : list.length ? 'login.who' : 'auth.signIn') + '</h2>';
  h += '<p class="muted">' + t(mode === 'choose' ? 'login.chooseHint' : mode === 'new' ? 'login.addName' : list.length ? 'login.tapName' : 'login.idHint') + '</p>';
  if (!canStore) h += '<p class="note warn">' + t('login.blocked') + '</p>';
  if (ui.loginMsg) h += '<p class="fmsg" role="alert">' + esc(t(ui.loginMsg)) + '</p>';
  h += cloudDeleteNote();
  if (mode === 'choose')
    h += '<div id="modeChoose"><div class="paths">' +
      '<button type="button" class="pathcard" data-mode="new"><b>' + t('login.choiceNew') + '</b><span>' + t('login.choiceNewSub') + '</span></button>' +
      '<button type="button" class="pathcard" data-mode="in"><b>' + t('login.choiceIn') + '</b><span>' + t('login.choiceInSub') + '</span></button></div></div>';
  h += '<div id="modeIn"' + (mode === 'in' ? '' : ' hidden') + '>';
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
            '</b><span class="muted small" dir="ltr">' +
            esc(p.id) +
            '</span></span></button>',
        )
        .join('') +
      '</div>';
  const selected = list.find((p) => p.id === selectedLogin);
  if (selected) {
    const create = !hasPassword(selected.id);
    h += '<form id="studentSignIn" class="sform" novalidate><h3 dir="auto">' + esc(selected.name) +
      '</h3><p class="small muted">' + t(create ? 'auth.enroll' : 'auth.enter') + '</p>' +
      passwordFields('si', create) + '<p class="fmsg" id="siMsg" role="alert"></p><div class="btnrow">' +
      '<button class="btn primary" type="submit">' + t(create ? 'auth.set' : 'auth.signIn') + '</button></div></form>';
  }
  if (syncOn) h += '<details class="more"' + (list.length ? '' : ' open') + '><summary>' + t('auth.otherDevice') +
    '</summary><form id="cloudSignIn" class="sform" novalidate><label class="field"><span class="small muted">' +
    t('auth.id') + '</span><input id="csId" dir="ltr" maxlength="64" autocomplete="username" autocapitalize="none" spellcheck="false"></label>' +
    passwordFields('cs', false) + '<details class="more"><summary>' + t('auth.forgot') +
    '</summary><label class="field"><span class="small muted">' + t('auth.resetCode') +
    '</span><input id="csCode" dir="ltr" maxlength="64" autocomplete="off" autocapitalize="none" spellcheck="false"></label></details>' +
    '<p class="fmsg" id="csMsg" role="alert"></p><div class="btnrow">' +
    '<button class="btn primary" type="submit">' + t('auth.signIn') + '</button></div></form></details>';
  h += (mode === 'in' ? '<p class="swap"><button type="button" class="link" data-mode="new">' + t('login.toNew') + '</button></p>' : '') + '</div><div id="modeNew"' + (mode === 'new' ? '' : ' hidden') + '>';
  h +=
    '<form id="newStudent" class="sform" novalidate autocomplete="off">';
  h +=
    '<label class="field"><span class="small muted">' +
    t('f.name') +
    '</span><input id="nsName" maxlength="24" dir="auto" autocapitalize="words" spellcheck="false"></label>';
  h += '<label class="field"><span class="small muted">' + t('auth.id') +
    '</span><input id="nsId" dir="ltr" maxlength="64" autocomplete="username" autocapitalize="none" spellcheck="false" value="' + newId() +
    '"><span class="small muted">' + t('auth.idHint') + '</span></label>' + passwordFields('ns', true);
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
    '<details class="more"><summary>' + t('login.import') + '</summary><div class="sform">' + passwordFields('im', true) +
    '<p class="small imp"><button class="link" id="importBtn" type="button">' +
    t('login.import') +
    '</button><span class="muted">' +
    t('login.importHint') +
    '</span></p><p class="fmsg" id="imMsg" role="alert"></p></div></details><input type="file" id="importFile" accept="application/json,.json" hidden>' +
    (mode === 'new' && (syncOn || list.length) ? '<p class="swap"><button type="button" class="link" data-mode="in">' + t('login.toIn') + '</button></p>' : '') + '</div>';
  h += '<footer class="credit"><p>' + t('credits') + '</p>' + byline() + '</footer>';
  root.innerHTML = h;
  ui.loginMsg = '';
  $$('[data-mode]', root).forEach((b) => {
    b.onclick = () => {
      loginMode = b.dataset.mode === 'new' ? 'new' : b.dataset.mode === 'choose' ? 'choose' : 'in';
      showLogin();
      window.scrollTo(0, 0);
    };
  });
  must('[data-change-lang]', root).onclick = () => {
    ui.langStep = true;
    showLogin();
  };
  $$('[data-login]', root).forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.login) {
          selectedLogin = b.dataset.login;
          showLogin();
          must('#siPassword', root, HTMLInputElement).focus();
        }
      }),
  );
  const nameInput = must('#nsName', root, HTMLInputElement);
  const levelSelect = must('#nsJl', root, HTMLSelectElement);
  const paceSelect = must('#nsPace', root, HTMLSelectElement);
  const signIn = $('#studentSignIn', root, HTMLFormElement);
  if (signIn && selected) signIn.onsubmit = async (e) => {
    e.preventDefault();
    const button = must('button[type=submit]', signIn, HTMLButtonElement);
    button.disabled = true;
    try {
      if (hasPassword(selected.id)) {
        if (!await verifyPassword(selected.id, must('#siPassword', signIn, HTMLInputElement).value)) throw new Error(t('auth.wrong'));
      } else await setPassword(selected.id, newPassword('si', signIn));
      if (signIn.isConnected) login(selected.id);
    } catch (error) {
      must('#siMsg', signIn).textContent = error instanceof Error ? error.message : t('auth.failed');
    } finally { button.disabled = false; }
  };
  const cloudSignIn = $('#cloudSignIn', root, HTMLFormElement);
  if (cloudSignIn) cloudSignIn.onsubmit = async (e) => {
    e.preventDefault();
    const button = must('button[type=submit]', cloudSignIn, HTMLButtonElement);
    button.disabled = true;
    try {
      const id = must('#csId', cloudSignIn, HTMLInputElement).value.trim();
      const password = must('#csPassword', cloudSignIn, HTMLInputElement).value;
      const local = students.list.find((p) => p.id === id);
      const resetCode = must('#csCode', cloudSignIn, HTMLInputElement).value.trim();
      if (resetCode) {
        await recoverCloud(id, resetCode, password);
        must('#csCode', cloudSignIn, HTMLInputElement).value = '';
      }
      if (local && hasPassword(id) && !resetCode && await verifyPassword(id, password)) {
        if (cloudSignIn.isConnected) login(id);
      } else {
        const data = await signInCloud(id, password);
        if (!cloudSignIn.isConnected) return;
        if (local) restoreStudent(data.student, data.progress);
        else addStudent(data.student, data.progress);
        login(id);
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      must('#csMsg', cloudSignIn).textContent = t(code === 'deployment' ? 'cloud.error.deployment' :
        code === 'network' ? 'cloud.error.network' : code === 'pending' ? 'auth.pending' : code === 'length' ? 'auth.length' :
        code === 'bad code' ? 'auth.badCode' : code === 'locked' ? 'auth.locked' : code === 'busy' || code === 'full' ? 'auth.busy' : 'auth.wrong');
    } finally { button.disabled = false; }
  };
  must('#newStudent', root).onsubmit = async (e) => {
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
    const id = must('#nsId', root, HTMLInputElement).value.trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) {
      msg.textContent = t('auth.badId');
      return;
    }
    if (students.list.some((p) => p.id === id)) {
      msg.textContent = t('auth.idTaken');
      return;
    }
    const age = must('#nsAge', root, HTMLSelectElement).value;
    const p = {
      id,
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
    const button = must('#newStudent button[type=submit]', root, HTMLButtonElement);
    button.disabled = true;
    try {
      await setPassword(id, newPassword('ns', root));
      if (!button.isConnected) return;
      addStudent(p, { start: ISO.test(start) ? start : todayISO() });
      enterApp();
    } catch (error) {
      msg.textContent = error instanceof Error ? error.message : t('auth.failed');
    } finally { button.disabled = false; }
  };
  levelSelect.onchange = () => {
    if (levelSelect.value === 'all') paceSelect.value = '7';
  };
  const importFile = must('#importFile', root, HTMLInputElement);
  must('#importBtn', root).onclick = () => {
    try { newPassword('im', root); importFile.click(); }
    catch (error) { must('#imMsg', root).textContent = error instanceof Error ? error.message : t('auth.failed'); }
  };
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
      const id = newId();
      await setPassword(id, newPassword('im', root));
      addStudent(
        { ...d.student, id, name, last: Date.now(), lang: d.student.lang || LANG },
        d.progress,
      );
      enterApp();
    } catch (err) {
      ui.loginMsg = 'err.badFile';
      showLogin();
    }
  };
  const first = mode === 'new' ? nameInput : mode === 'in' ? $('[data-login]', root) || $('#csId', root, HTMLInputElement) : $('[data-mode]', root);
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
  renderCloudSummary(p?.id || null);
  if (!p) {
    b.hidden = true;
    return;
  }
  b.innerHTML = avatar(p) + '<span class="nm" dir="auto">' + esc(p.name) + '</span>';
  b.setAttribute('aria-label', t('p.label', { name: p.name }));
  b.hidden = false;
}
function enterApp() {
  selectedLogin = null;
  loginMode = null;
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
  selectedLogin = null;
  loginMode = null;
  clearCurrentStudent();
  ui.session = null;
  ui.wq = null;
  showLogin();
}
