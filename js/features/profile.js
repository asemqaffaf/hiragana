import { restoreCloud, saveCloudNow, syncNow, syncOn } from '../core/cloud.js';
import { goalOf } from '../core/plan.js';
import { renderAll } from '../core/render-all.js';
import {
  MODES,
  TINTS,
  cleanTheme,
  isGuest,
  me,
  removeStudent,
  state,
  updateStudent,
} from '../core/store.js';
import { ui } from '../core/ui-state.js';
import { A46 } from '../data/letters.js';
import { setLang } from './language.js';
import { renderWho, showLogin, switchStudent } from './login.js';
import { moveThumb } from '../ui/thumb.js';
import { avatar, cleanName, nameTaken, swatches, syncText } from '../ui/student.js';
import {
  ageOpts,
  goalHint,
  jlOpts,
  languageOpts,
  minOpts,
  nativeOpts,
  paceOpts,
  rateOpts,
  reasonOpts,
  sel,
} from '../ui/profile-fields.js';
import { applyStudent, applyTheme } from '../ui/appearance.js';
import { cloudPanel } from '../ui/cloud-sync.js';
import { showCode } from '../core/student-code.js';
import { codePassword, setPassword, verifyPassword } from '../core/passwords.js';
import { LANG, t } from '../i18n/core.js';
import { $, $$, esc, must, todayISO } from '../util.js';

/* ---------- advanced student profile: identity, goals, levels, achievements, detailed stats ---------- */
/* shrink a photo to a 160 px square JPEG so it fits comfortably in localStorage */
/** @param {File} file @returns {Promise<string>} */
function photoToDataUrl(file) {
  return new Promise((res, rej) => {
    const img = new Image(),
      url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.naturalWidth, img.naturalHeight),
        c = document.createElement('canvas'),
        ctx = c.getContext('2d');
      c.width = c.height = 160;
      if (!ctx) {
        URL.revokeObjectURL(url);
        rej(new Error('no canvas'));
        return;
      }
      ctx.drawImage(
        img,
        (img.naturalWidth - s) / 2,
        (img.naturalHeight - s) / 2,
        s,
        s,
        0,
        0,
        160,
        160,
      );
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error('bad image'));
    };
    img.src = url;
  });
}
/** @type {readonly import('../../types/app').Avatar['t'][]} */
const AVATAR_TYPES = ['initial', 'kana', 'photo'];
let pfMsg = '',
  pfDelArmed = false;
/** A chosen photo, as a data URL, until the next save keeps it. @type {string | null} */
let pendingPhoto = null;
/** A brief "Saved." above the tab bar (the same glass pill the repeat tip uses). */
let savedTimer = 0;
function savedToast() {
  document.querySelectorAll('.pf-saved').forEach((n) => n.remove());
  clearTimeout(savedTimer);
  const el = document.createElement('div');
  el.className = 'rep-hint pf-saved';
  el.setAttribute('role', 'status');
  el.textContent = t('pf.saved');
  document.body.appendChild(el);
  savedTimer = window.setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, 1500);
}
export function renderProfile() {
  const p = me();
  if (!p) return;
  const g = goalOf(p),
    av = p.av;
  let h =
    '<div class="phero">' +
    avatar(p, 'xl') +
    '<div><h2 dir="auto">' +
    esc(p.name) +
    '</h2><p class="small muted">' +
    t('pf.heroNote') +
    '</p></div></div>';
  /* appearance: applied at once and saved with the student */
  const th = cleanTheme(p.theme);
  /* [paper, surface, grid] for light, then for dark, so each preview matches the mode in use */
  /** @type {Record<import('../../types/app').Tint, string[]>} */
  const TC = {
    slate: ['#F3F4F5', '#FFFFFF', '#BCC3C9', '#17191C', '#1F2226', '#474D55'],
    sand: ['#F8F4EC', '#FFFFFF', '#D8CDB4', '#211C14', '#2A241A', '#5A4D36'],
    sky: ['#F1F6FA', '#FFFFFF', '#B4CADB', '#121D28', '#192733', '#3A5870'],
    rose: ['#FBF3F2', '#FFFFFF', '#E0BDB8', '#241A1B', '#2E2223', '#5E4040'],
    lilac: ['#F5F3FA', '#FFFFFF', '#C8C0DD', '#1B1826', '#241F32', '#4E4670'],
    sage: ['#F5F7F3', '#FFFFFF', '#B7D2C8', '#15221D', '#1B2B25', '#3A5A4F'],
    white: ['#FFFFFF', '#F6F7F5', '#C3D3CC', '#000000', '#111513', '#3A4A43'],
  };
  h +=
    '<h3>' +
    t('pf.look') +
    '</h3><div class="themebox"><span class="small muted">' +
    t('th.mode') +
    '</span><div class="seg modeseg" role="tablist" aria-label="' +
    t('th.mode') +
    '" data-thumb-key="mode">' +
    MODES.map(
      (m) =>
        '<button type="button" role="tab" data-mode="' +
        m +
        '" id="modeTab-' +
        m +
        '" aria-selected="' +
        (th.mode === m) +
        '" aria-pressed="' +
        (th.mode === m) +
        '">' +
        t(`th.${m}`) +
        '</button>',
    ).join('') +
    '</div>';
  h +=
    '<fieldset class="tints"><legend class="small muted">' +
    t('th.bg') +
    '</legend><div class="tintgrid">' +
    TINTS.map(
      (k) =>
        '<label class="tint"><input type="radio" name="pfTint" value="' +
        k +
        '"' +
        (th.tint === k ? ' checked' : '') +
        '><span class="tp" style="--c:' +
        TC[k][0] +
        ';--s:' +
        TC[k][1] +
        ';--g:' +
        TC[k][2] +
        ';--cd:' +
        TC[k][3] +
        ';--sd:' +
        TC[k][4] +
        ';--gd:' +
        TC[k][5] +
        '"></span><span>' +
        t(`th.${k}`) +
        '</span></label>',
    ).join('') +
    '</div></fieldset><p class="small muted">' +
    t('th.note') +
    '</p></div>';
  /* details and goals */
  h +=
    '<h3>' +
    t('pf.details') +
    '</h3><form id="pfForm" class="sform pform" novalidate autocomplete="off">';
  h +=
    '<label class="field"><span class="small muted">' +
    t('f.name') +
    '</span><input id="pfName" maxlength="24" dir="auto" value="' +
    esc(p.name) +
    '"></label><p class="fmsg" id="pfMsg" role="alert">' +
    esc(pfMsg) +
    '</p>';
  h +=
    '<fieldset class="avpick"><legend class="small muted">' +
    t('f.avatar') +
    '</legend>' +
    AVATAR_TYPES.map(
        (x) =>
          '<label><input type="radio" name="pfAv" value="' +
          x +
          '"' +
          (av.t === x ? ' checked' : '') +
          '> ' +
          t(`av.${x}`) +
          '</label>',
      )
      .join('') +
    '</fieldset>';
  h +=
    '<div class="avopts"><label class="field avk"><span class="small muted">' +
    t('av.kana') +
    '</span><select id="pfKana">' +
    A46.map((k) => '<option' + (av.k === k ? ' selected' : '') + '>' + k + '</option>').join('') +
    '</select></label>';
  h +=
    '<div class="field avp"><button class="btn" type="button" id="pfPhotoBtn">' +
    t('av.upload') +
    '</button><input type="file" id="pfPhoto" accept="image/*" hidden><span class="small muted">' +
    t('av.note') +
    '</span></div></div>';
  h += swatches('pfColor', p.color);
  h +=
    '<div class="fgrid">' +
    sel('pfAge', ageOpts(), p.age || 'adult', t('f.age')) +
    sel('pfNative', nativeOpts(), p.native || LANG, t('f.native')) +
    sel('pfJl', jlOpts(), p.jlevel || 'new', t('f.jlevel')) +
    sel('pfLang', languageOpts(), p.lang || LANG, t('f.uiLang')) +
    sel('pfRate', rateOpts(), p.rate, t('f.rate')) +
    sel('pfReason', reasonOpts(), g.reason, t('f.reason'), goalHint(g.reason)) +
    sel('pfPace', paceOpts(), g.pace, t('f.pace')) +
    sel('pfMin', minOpts(), g.min, t('f.min')) +
    '</div>';
  /* no Save button: every change is saved as it is made (a hidden submit keeps Enter in the name field working) */
  h += '<p class="small muted">' + t('pace.change') + '</p><button type="submit" hidden></button></form>';
  /* data */
  h += '<h3>' + t('pf.data') + '</h3><p class="small muted">' + syncText() + '</p>';
  if (syncOn && !isGuest(p.id)) {
    h += '<div class="codebox"><span class="small muted">' + t('auth.id') + '</span><b class="code" dir="ltr" id="pCode">' + esc(showCode(p.id)) +
      '</b><div class="btnrow"><button class="btn" type="button" id="pCopy">' + t('code.copy') + '</button></div>' +
      '<p class="small muted">' + t('code.hint') + '</p>' +
      '<div id="pNoPw" hidden><p class="small muted">' + t('code.hasPassword') + '</p><div class="btnrow"><button class="btn" type="button" id="pNoPwBtn">' +
      t('code.removePassword') + '</button></div></div></div>';
  }
  h += cloudPanel(p.id);
  h +=
    '<div class="btnrow"><button class="btn" id="pExport">' +
    t('p.export') +
    '</button><button class="btn primary" id="pSwitch">' +
    t('p.switch') +
    '</button></div>';
  h +=
    '<div class="btnrow"><button class="btn red" id="pDelete">' +
    (pfDelArmed ? t(syncOn && !isGuest(p.id) ? 'cloud.deleteConfirm' : 'p.deleteConfirm', { name: esc(p.name) }) : t('p.delete')) +
    '</button></div>';
  const root = must('#tab-profile');
  const same = root.dataset.rendered === '1';
  root.innerHTML = h;
  root.dataset.rendered = '1';
  const modeSeg = $('.modeseg', root);
  moveThumb(modeSeg, 'mode', !same);
  const copyButton = $('#pCopy', root, HTMLButtonElement);
  /** @param {HTMLButtonElement} button @param {string} text @param {string} done */
  const copyText = async (button, text, done) => {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; }
    catch {
      const box = document.createElement('textarea');
      box.value = text;
      box.setAttribute('readonly', '');
      box.style.cssText = 'position:fixed;opacity:0;top:0';
      document.body.appendChild(box);
      box.select();
      try { ok = document.execCommand('copy'); } catch {}
      box.remove();
    }
    const label = button.textContent;
    button.textContent = ok ? done : t('code.copyFail');
    setTimeout(() => { button.textContent = label; }, 2000);
  };
  if (copyButton) copyButton.onclick = () => copyText(copyButton, showCode(p.id), t('code.copied'));
  // A profile made before passwords were dropped still has one: offer to switch it to code-only sign-in.
  const noPw = $('#pNoPw', root);
  if (noPw) {
    const profileId = p.id;
    void verifyPassword(profileId, codePassword(profileId)).then((codeOnly) => {
      if (!codeOnly && noPw.isConnected) noPw.hidden = false;
    }, () => {});
    const noPwBtn = must('#pNoPwBtn', noPw, HTMLButtonElement);
    noPwBtn.onclick = async () => {
      noPwBtn.disabled = true;
      try {
        await setPassword(profileId, codePassword(profileId));
        await saveCloudNow(profileId);
        must('p', noPw).textContent = t('code.passwordRemoved');
        noPwBtn.hidden = true;
      } catch (error) { noPwBtn.disabled = false; }
    };
  }
  const cloudSave = $('#cloudSave', root, HTMLButtonElement);
  const cloudRestore = $('#cloudRestore', root, HTMLButtonElement);
  if (cloudSave) cloudSave.onclick = async () => {
    cloudSave.disabled = true;
    try { await syncNow(p.id); }
    finally { cloudSave.disabled = false; }
  };
  if (cloudRestore) {
    let armed = false;
    cloudRestore.onclick = async () => {
      if (!armed) {
        armed = true;
        cloudRestore.textContent = t('cloud.restoreConfirm');
        setTimeout(() => { armed = false; cloudRestore.textContent = t('cloud.restore'); }, 5000);
        return;
      }
      cloudRestore.disabled = true;
      try {
        await restoreCloud(p.id);
        if (me()?.id === p.id) {
          setLang(p.lang);
          applyStudent();
          renderWho();
          renderAll();
        }
      } catch { /* The cloud status explains the failure. */ }
      finally { cloudRestore.disabled = false; }
    };
  }
  pfMsg = '';
  /** @param {Partial<import('../../types/app').Theme>} patch */
  const setTheme = (patch) => {
    updateStudent(p.id, { theme: { ...cleanTheme(p.theme), ...patch } });
    applyTheme(p.theme, true);
  };
  $$('[data-mode]', root).forEach(
    (b) =>
      (b.onclick = () => {
        const mode = MODES.find((m) => m === b.dataset.mode);
        if (mode) {
          setTheme({ mode });
          $$('[data-mode]', root).forEach((x) => {
            const on = x === b;
            x.setAttribute('aria-selected', String(on));
            x.setAttribute('aria-pressed', String(on));
          });
          moveThumb(modeSeg, 'mode');
        }
      }),
  );
  $$('input[name="pfTint"]', root, HTMLInputElement).forEach(
    (r) =>
      (r.onchange = () => {
        const tint = TINTS.find((k) => k === r.value);
        if (tint) setTheme({ tint });
      }),
  );
  /** The value of a radio group, if one is chosen. @param {string} name */
  const checked = (name) => $(`input[name="${name}"]:checked`, root, HTMLInputElement)?.value;
  const syncAv = () => {
    const v = checked('pfAv');
    must('.avk', root).hidden = v !== 'kana';
    must('.avp', root).hidden = v !== 'photo';
  };
  $$('input[name="pfAv"]', root, HTMLInputElement).forEach((r) => (r.onchange = syncAv));
  syncAv();
  const photoInput = must('#pfPhoto', root, HTMLInputElement);
  must('#pfPhotoBtn', root).onclick = () => photoInput.click();
  photoInput.onchange = async () => {
    const f = photoInput.files && photoInput.files[0];
    if (!f) return;
    try {
      pendingPhoto = await photoToDataUrl(f);
      must('#pfPhotoBtn', root).textContent = t('av.ready');
      save();
    } catch (err) {
      must('#pfMsg', root).textContent = t('av.bad');
    }
  };
  /** @param {string} id */
  const selectValue = (id) => must('#' + id, root, HTMLSelectElement).value;
  /** Save every field of the form now. Runs after each change; a name that is empty or taken keeps the old name and says why. */
  const save = () => {
    const msg = must('#pfMsg', root);
    let name = cleanName(must('#pfName', root, HTMLInputElement).value);
    msg.textContent = '';
    if (!name) {
      msg.textContent = t('err.noName');
      name = p.name;
    } else if (nameTaken(name, p.id)) {
      msg.textContent = t('err.taken2', { name });
      name = p.name;
    }
    const avT = checked('pfAv') || 'initial';
    /* "Photo" is chosen but no photo yet: wait, the upload button is right there */
    if (avT === 'photo' && !pendingPhoto && !p.av.img) return;
    const y = scrollY;
    updateStudent(p.id, {
      name,
      color: checked('pfColor') || p.color,
      av: {
        t: avT,
        k: selectValue('pfKana'),
        img: avT === 'photo' ? pendingPhoto || p.av.img : '',
      },
      age: selectValue('pfAge'),
      native: selectValue('pfNative'),
      jlevel: selectValue('pfJl'),
      rate: Number(selectValue('pfRate')) === 0.75 ? 0.75 : 1,
      goal: {
        pace: Number(selectValue('pfPace')),
        min: Number(selectValue('pfMin')),
        reason: selectValue('pfReason'),
      },
      lang: selectValue('pfLang'),
    });
    pendingPhoto = null;
    setLang(p.lang);
    applyStudent();
    renderWho();
    const error = msg.textContent;
    pfMsg = error || '';
    renderAll(); /* redraws this page too, so the heading, goal hint and language are current */
    scrollTo(0, y); /* and the page stays where the person was */
    if (!error) savedToast();
  };
  const form = must('#pfForm', root);
  form.onchange = save;
  form.onsubmit = (e) => {
    e.preventDefault();
    save();
  };
  must('#pExport', root).onclick = exportStudent;
  must('#pSwitch', root).onclick = () => {
    pfDelArmed = false;
    switchStudent();
  };
  must('#pDelete', root).onclick = () => {
    if (!pfDelArmed) {
      pfDelArmed = true;
      renderProfile();
      setTimeout(() => {
        if (pfDelArmed) {
          pfDelArmed = false;
          if (ui.currentTab === 'profile') renderProfile();
        }
      }, 5000);
      return;
    }
    pfDelArmed = false;
    removeStudent(p.id);
    ui.loginMsg = '';
    showLogin();
  };
}
function exportStudent() {
  const p = me();
  if (!p) return;
  const data = {
    app: 'hiragana14',
    kind: 'student',
    v: 1,
    exported: new Date().toISOString(),
    student: {
      name: p.name,
      color: p.color,
      created: p.created,
      lang: p.lang || LANG,
      age: p.age,
      native: p.native,
      jlevel: p.jlevel,
      rate: p.rate,
      goal: p.goal,
      av: p.av,
      theme: p.theme,
    },
    progress: state,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  const slug =
    p.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'student';
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hiragana-' + slug + '-' + todayISO() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
