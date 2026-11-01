import {TABS, showTab} from '../core/nav.js';
import {goalOf} from '../core/plan.js';
import {renderAll} from '../core/render-all.js';
import {COLORS, ISO, canStore, cleanStudent, commit, deviceTheme, loadProgress, me, normalize, replaceState, saveStudents, state, students} from '../core/storage.js';
import {ui} from '../core/ui-state.js';
import {A46, ALL} from '../data/letters.js';
import {checkBadges} from './gamify.js';
import {deviceLang, langSeg, setLang} from './language.js';
import {ageOpts, applyStudent, goalHint, jlOpts, minOpts, paceOpts, reasonOpts, sel} from './profile.js';
import {LANG, t} from '../i18n/core.js';
import {fmt} from '../i18n/helpers.js';
import {closeSheet} from '../ui/sheet.js';
import {$, $$, addDays, esc, isoToUTC, todayISO} from '../util.js';

/* ---------- students: passwordless login and profile ---------- */
function newId() { try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 16); } catch (e) {} return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
const initialOf = name => (Array.from(name.trim())[0] || '?').toUpperCase();
export function avatar(p, cls) {
  const av = p.av || {}, base = '<span class="av' + (cls ? ' ' + cls : '') + (av.t === 'kana' ? ' avkana' : '') + '" style="--c:' + p.color + '" aria-hidden="true">';
  if (av.t === 'photo' && /^data:image\/(jpeg|png);base64,/.test(av.img || '')) return base + '<img src="' + av.img + '" alt=""></span>';
  if (av.t === 'kana' && A46.includes(av.k)) return base + av.k + '</span>';
  return base + esc(initialOf(p.name)) + '</span>';
}
export const cleanName = v => String(v || '').replace(/\s+/g, ' ').trim().slice(0, 24);
export const nameTaken = (name, exceptId) => students.list.some(p => p.id !== exceptId && p.name.toLowerCase() === name.toLowerCase());
function planDay(s) { return Math.floor((isoToUTC(todayISO()) - isoToUTC(s.start)) / 86400000) + 1; }
function summaryOf(s, sp) {
  const n = planDay(s), solid = ALL.filter(k => ((s.stats[k] || {}).b || 0) >= 4).length;
  return t('summary', {day: n < 1 ? t('plan.starts', {date: fmt(s.start)}) : n > goalOf(sp).pace ? t('plan.complete') : t('plan.dayOf', {n, total: goalOf(sp).pace}), s: solid});
}
export function streakOf(act) { let d = todayISO(), n = 0; if (!(act[d] > 0)) d = addDays(d, -1); while (act[d] > 0) { n++; d = addDays(d, -1); } return n; }
export function swatches(name, chosen) {
  return '<fieldset class="swatches"><legend class="small muted">' + t('f.colour') + '</legend>' + COLORS.map((c, i) => '<label class="sw"><input type="radio" name="' + name + '" value="' + c + '"' + (c === chosen ? ' checked' : '') + '><span class="dotc" style="--c:' + c + '"></span><span class="vh">' + t('f.colourN', {n: i + 1}) + '</span></label>').join('') + '</fieldset>';
}
export function showLogin() {
  closeSheet('silent');
  ui.navStack = [];
  setLang(deviceLang());
  const bb = $('#backBar'); if (bb) bb.hidden = true;
  document.body.classList.add('signed-out'); document.body.classList.remove('kid');
  $$('.tab').forEach(s => { s.hidden = true; });
  const who = $('#whoBtn'); who.hidden = true; who.innerHTML = '';
  const root = $('#login'); root.hidden = false;
  const list = students.list.slice().sort((x, y) => (y.last || 0) - (x.last || 0));
  let h = langSeg(LANG, 'langseg');
  h += '<h2>' + t(list.length ? 'login.who' : 'login.create') + '</h2>';
  h += '<p class="muted">' + t(list.length ? 'login.tapName' : 'login.addName') + '</p>';
  if (!canStore) h += '<p class="note warn">' + t('login.blocked') + '</p>';
  if (ui.loginMsg) h += '<p class="fmsg" role="alert">' + esc(t(ui.loginMsg)) + '</p>';
  if (list.length) h += '<div class="students">' + list.map(p => '<button class="student" data-login="' + esc(p.id) + '"' + (p.lang ? ' lang="' + p.lang + '"' : '') + '>' + avatar(p) + '<span class="sn"><b dir="auto">' + esc(p.name) + '</b><span class="muted small">' + summaryOf(normalize(loadProgress(p.id)), p) + '</span></span></button>').join('') + '</div>';
  h += (list.length ? '<h3>' + t('login.add') + '</h3>' : '') + '<form id="newStudent" class="sform" novalidate autocomplete="off">';
  h += '<label class="field"><span class="small muted">' + t('f.name') + '</span><input id="nsName" maxlength="24" dir="auto" autocapitalize="words" spellcheck="false"></label>';
  h += swatches('nsColor', COLORS[list.length % COLORS.length]);
  h += '<label class="field"><span class="small muted">' + t('f.start') + '</span><input type="date" id="nsStart" value="' + todayISO() + '"></label>';
  h += '<div class="fgrid">' + sel('nsAge', ageOpts(), 'adult', t('f.age')) + sel('nsJl', jlOpts(), 'new', t('f.jlevel')) + sel('nsPace', paceOpts(), 14, t('f.pace')) + sel('nsMin', minOpts(), 30, t('f.min')) + sel('nsReason', reasonOpts(), 'jlpt', t('f.reason'), goalHint('jlpt')) + '</div>';
  h += '<p class="fmsg" id="nsMsg" role="alert"></p>';
  h += '<div class="btnrow"><button class="btn primary" type="submit">' + t('login.createBtn') + '</button></div></form>';
  h += '<p class="small imp"><button class="link" id="importBtn" type="button">' + t('login.import') + '</button><span class="muted">' + t('login.importHint') + '</span></p><input type="file" id="importFile" accept="application/json,.json" hidden>';
  h += '<footer class="credit"><p>' + t('credits') + '</p></footer>';
  root.innerHTML = h;
  ui.loginMsg = '';
  $$('[data-lang]', root).forEach(b => b.onclick = () => { students.lang = b.dataset.lang; saveStudents(); showLogin(); });
  $$('[data-login]', root).forEach(b => b.onclick = () => login(b.dataset.login));
  $('#newStudent', root).onsubmit = e => {
    e.preventDefault();
    const name = cleanName($('#nsName', root).value), msg = $('#nsMsg', root);
    const color = (root.querySelector('input[name="nsColor"]:checked') || {}).value || COLORS[0];
    const start = $('#nsStart', root).value;
    if (!name) { msg.textContent = t('err.noName'); $('#nsName', root).focus(); return; }
    if (nameTaken(name)) { msg.textContent = t('err.taken', {name}); $('#nsName', root).focus(); return; }
    const age = $('#nsAge', root).value;
    const p = {id: newId(), name, color, created: todayISO(), last: Date.now(), lang: LANG, age, jlevel: $('#nsJl', root).value, native: LANG, rate: age === 'child' ? 0.75 : 1,
      goal: {pace: +$('#nsPace', root).value, min: +$('#nsMin', root).value, reason: $('#nsReason', root).value}, av: {t: 'initial', k: 'あ', img: ''}, theme: deviceTheme()};
    students.list.push(p); students.current = p.id; saveStudents();
    replaceState(normalize({start: ISO.test(start) ? start : todayISO()}));
    commit();
    enterApp();
  };
  $('#nsJl', root).onchange = e => { if (e.target.value === 'all') $('#nsPace', root).value = '7'; };
  $('#importBtn', root).onclick = () => $('#importFile', root).click();
  $('#importFile', root).onchange = async e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      if (f.size > 2e6) throw new Error('too big');
      const d = JSON.parse(await f.text());
      if (!d || d.app !== 'hiragana14' || !d.student || typeof d.student.name !== 'string' || !d.progress) throw new Error('not ours');
      const base = cleanName(d.student.name) || 'Student';
      let name = base, i = 2;
      while (nameTaken(name)) name = base.slice(0, 19) + ' (' + (i++) + ')';
      const p = cleanStudent(Object.assign({}, d.student, {id: newId(), name, last: Date.now()})); if (!p.lang) p.lang = LANG;
      students.list.push(p); students.current = p.id; saveStudents();
      replaceState(normalize(d.progress));
      commit();
      enterApp();
    } catch (err) { ui.loginMsg = 'err.badFile'; showLogin(); }
  };
  const first = $('[data-login]', root) || $('#nsName', root);
  if (first && !matchMedia('(pointer: coarse)').matches) first.focus();
}
export function login(id) {
  const p = students.list.find(x => x.id === id);
  if (!p) return showLogin();
  p.last = Date.now(); students.current = id; saveStudents();
  setLang(p.lang || deviceLang());
  replaceState(normalize(loadProgress(id)));
  enterApp();
}
export function renderWho() {
  const p = me(), b = $('#whoBtn');
  if (!p) { b.hidden = true; return; }
  b.innerHTML = avatar(p) + '<span class="nm" dir="auto">' + esc(p.name) + '</span>';
  b.setAttribute('aria-label', t('p.label', {name: p.name}));
  b.hidden = false;
}
function enterApp() {
  document.body.classList.remove('signed-out');
  const root = $('#login'); root.hidden = true; root.innerHTML = '';
  ui.session = null; ui.wq = null; ui.demoShown = false; ui.resetArmed = false; ui.drillSel = new Set(['today']); ui.chartView = 'basic';
  renderWho();
  applyStudent();
  const kid = (me() || {}).age === 'child';
  ui.drillLen = kid ? 10 : goalOf().min === 10 ? 10 : 20; ui.showRo = kid;
  ui.lastLevel = 0; checkBadges(true);
  ui.currentTab = 'plan';
  renderAll();
  const h = location.hash.slice(1);
  showTab(TABS.includes(h) ? h : 'plan', {initial: true});
}
export function switchStudent() { students.current = null; saveStudents(); ui.session = null; ui.wq = null; showLogin(); }
