import { me } from './store.js';
import { recordHeard } from './progress.js';
import { AUD } from '../data/audio-manifest.js';
import { EXAMPLES } from '../data/content.js';
import { EXTRA } from '../data/daily.js';
import { K, t } from '../i18n/core.js';
import { exampleMeaning, meanOf } from '../i18n/helpers.js';
import { $, $$, SPEAK_SVG } from '../util.js';

/** @type {AudioContext | null} */
export let actx = null;
/** @type {HTMLAudioElement | null} */
export let htmlAudio = null;
export let htmlOK = true;
/** @type {AudioBufferSourceNode | null} */
let waSrc = null;
/** @type {Map<string, AudioBuffer>} */
const bufCache = new Map();
/* ---- audio ----
   iPhone rules this is built around:
   - one <audio> element is reused, and it is "unlocked" by a real touch before any timer-started sound;
   - starting a new clip while another is loading makes the old play() promise reject with AbortError.
     That is normal and must NOT switch playback to another engine (an earlier version did, and then
     Web Audio, which the silent switch mutes and which needs a fresh touch to resume, took over for good);
   - the Audio Session API (iOS 16.4+) is set to "playback" so sound is not muted by the ring/silent switch. */
try {
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
} catch (e) {}
export let htmlUnlocked = false,
  playTok = 0,
  htmlFails = 0;
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';
function mediaEl() {
  if (!htmlAudio) {
    htmlAudio = new Audio();
    htmlAudio.preload = 'auto';
    htmlAudio.setAttribute('playsinline', '');
    htmlAudio.addEventListener('error', onAudioError);
  }
  return htmlAudio;
}
function onAudioError() {
  /* the clip could not be loaded or decoded: play the same clip through Web Audio instead, but keep trying HTML audio next time */
  if (!htmlAudio || !htmlAudio.currentSrc || htmlAudio.currentSrc.startsWith('data:')) return;
  if (htmlAudio.currentSrc.startsWith('blob:') && lastKey) {
    URL.revokeObjectURL(htmlAudio.currentSrc);
    blobCache.delete(lastKey);
  }
  const key = lastKey;
  if (key && ++htmlFails >= 4) htmlOK = false;
  if (key) playWA(key);
}
/** @type {string | null} */
let lastKey = null;
function unlockHtml() {
  if (htmlUnlocked) return;
  htmlUnlocked = true;
  try {
    const a = mediaEl();
    a.muted = true;
    a.src = SILENT_WAV;
    const done = () => {
      if (a.src !== SILENT_WAV) return;
      /* a real clip already took over: leave it alone */ try {
        a.pause();
      } catch (e) {}
      a.muted = false;
    };
    const p = a.play();
    if (p && p.then) p.then(done, done);
    else done();
  } catch (e) {}
}
/* Web Audio is only the fallback, so it is created on demand: on iPhone, starting an AudioContext
   while an <audio> clip plays can interrupt that clip. */
function unlockAudio() {
  unlockHtml();
  if (actx && actx.state !== 'running') actx.resume().catch(() => {});
}
/** @returns {AudioContext | null} */
function ensureCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!actx && AC) {
    try {
      actx = new AC();
    } catch (e) {
      actx = null;
    }
  }
  return actx;
}
/* keep each clip's bytes in memory once fetched: replays then start at once and never wait on the network */
/** @type {Map<string, string>} */
const blobCache = new Map();
/** @type {Set<string>} */
const blobPending = new Set();
/** @param {string} key */
export function cacheClip(key) {
  if (
    !AUD[key] ||
    blobCache.has(key) ||
    blobPending.has(key) ||
    !window.fetch ||
    !window.URL ||
    !URL.createObjectURL
  )
    return;
  blobPending.add(key);
  fetch(clipUrl(key))
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('Clip not found'))))
    .then((b) => {
      if (b.size > 1000) blobCache.set(key, URL.createObjectURL(b));
    })
    .catch(() => {})
    .then(() => blobPending.delete(key));
}
document.addEventListener('pointerdown', unlockAudio, true);
document.addEventListener('touchend', unlockAudio, { capture: true, passive: true });
document.addEventListener('keydown', unlockAudio, true);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && actx && actx.state !== 'running') actx.resume().catch(() => {});
});
/** @param {string} key */
const clipUrl = (key) => 'audio/' + AUD[key];
/* the callback form of decodeAudioData is the one older Safari versions support */
/** @param {AudioContext} ctx @param {ArrayBuffer} data @returns {Promise<AudioBuffer>} */
const decode = (ctx, data) =>
  new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject));
/** @param {string} key */
async function playWA(key) {
  const ctx = ensureCtx();
  if (!ctx) return;
  const tok = playTok;
  try {
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch (e) {}
    }
    let buf = bufCache.get(key);
    if (!buf) {
      const ab = await (await fetch(clipUrl(key))).arrayBuffer();
      buf = await decode(ctx, ab);
      bufCache.set(key, buf);
    }
    if (tok !== playTok) return; /* a newer clip was asked for while this one loaded */
    if (waSrc) {
      try {
        waSrc.stop();
      } catch (e) {}
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
    waSrc = src;
  } catch (e) {}
}
/** @param {string} key */
function playClip(key) {
  const tok = ++playTok;
  lastKey = key;
  if (waSrc) {
    try {
      waSrc.stop();
    } catch (e) {}
    waSrc = null;
  }
  if (htmlOK) {
    try {
      const a = mediaEl();
      try {
        a.pause();
      } catch (e) {}
      a.muted = false;
      a.src = blobCache.get(key) || clipUrl(key);
      cacheClip(key);
      a.defaultPlaybackRate = a.playbackRate = audioRate();
      try {
        a.preservesPitch = true;
        a.webkitPreservesPitch = true;
      } catch (e) {}
      const pr = a.play();
      if (pr && pr.catch)
        pr.catch((err) => {
          if (tok !== playTok) return; /* replaced by a newer clip: nothing to do */
          const n = err && err.name;
          if (n === 'AbortError') return; /* interrupted by a load or pause: normal */
          if (n === 'NotAllowedError')
            return; /* started by a timer with no touch yet: the Hear button will work */
          if (++htmlFails >= 4) htmlOK = false;
          playWA(key);
        });
      return;
    } catch (e) {
      if (++htmlFails >= 4) htmlOK = false;
    }
  }
  playWA(key);
}
/** @param {string} text */
function deviceSpeak(text) {
  if (!('speechSynthesis' in window)) return false;
  try {
    const u = new SpeechSynthesisUtterance(text.replace(/ /g, ''));
    u.lang = 'ja-JP';
    u.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return true;
  } catch (e) {
    return false;
  }
}
/** @param {string} t */
export const hasClip = (t) => !!AUD[t];
const audioRate = () => (me()?.rate === 0.75 ? 0.75 : 1);
/* Hear buttons: the letter twice, then an example word */
/** @param {string} k */
export function speakFull(k) {
  if (AUD[k + '|ex']) {
    recordHeard(k);
    playClip(k + '|ex');
    return true;
  }
  return speak(k);
}
/** @param {string} k */
export function exampleHtml(k) {
  const e = EXAMPLES[k];
  if (!e) return '';
  return (
    '<p class="ex"><span class="muted small">' +
    t('ex.label') +
    '</span> ' +
    K(e[0]) +
    ' <span class="ltr">(' +
    e[1] +
    ')</span> ' +
    exampleMeaning(k) +
    '</p>'
  );
}
/** @param {string} k */
export function moreExHtml(k) {
  const L = EXTRA[k];
  if (!L || !L.length) return '';
  return (
    '<div class="morex"><span class="small muted">' +
    t('ex.more', { k }) +
    '</span>' +
    L.map(
      (w) =>
        '<div class="mx"><span class="kana" dir="ltr">' +
        w[0] +
        '</span><span class="ro ltr">' +
        w[1] +
        '</span><span class="mean">' +
        meanOf(w, 'extraMeanings') +
        '</span><button class="say" type="button" data-say="' +
        w[0] +
        '" aria-label="' +
        t('read.hear', { w: w[0] }) +
        '">' +
        SPEAK_SVG +
        '</button></div>',
    ).join('') +
    '</div>'
  );
}
/* a quick highlight on whatever box was tapped, so the tap feels answered */
/** @type {WeakMap<Element, number>} */
const flashTimers = new WeakMap();
/** @param {Element | null} el */
export function flash(el) {
  if (!el) return;
  el.classList.add('playing');
  clearTimeout(flashTimers.get(el));
  flashTimers.set(el, setTimeout(() => el.classList.remove('playing'), 700));
}
/** @param {ParentNode} root */
export function bindSay(root) {
  $$('.morex .mx', root).forEach((r) => {
    const b = $('[data-say]', r);
    if (!b) return;
    r.onclick = (e) => {
      e.stopPropagation();
      speak(b.dataset.say || '');
      flash(r);
    };
  });
}
/** @param {string} text */
export function speak(text) {
  recordHeard(text);
  if (AUD[text]) {
    playClip(text);
    return true;
  }
  return deviceSpeak(text);
}
