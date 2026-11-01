import { t } from '../i18n/core.js';
import { meanOf } from '../i18n/helpers.js';
import { SPEAK_SVG } from '../util.js';

/** @param {readonly string[]} w @param {string} [cls] @param {string} [meaning] */
export function wordCard(w, cls, meaning = meanOf(w)) {
  return (
    '<div class="word' +
    (cls || '') +
    '" role="button" tabindex="0" data-word><span class="kana" dir="ltr">' +
    w[0] +
    '</span><span class="ro" dir="ltr">' +
    w[1] +
    '</span><span class="mean">' +
    meaning +
    '</span><button class="say" data-say="' +
    w[0] +
    '" aria-label="' +
    t('read.hear', { w: w[0] }) +
    '">' +
    SPEAK_SVG +
    '</button></div>'
  );
}
