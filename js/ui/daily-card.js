import { t } from '../i18n/core.js';
import { dailySentenceMeaning, meanOf } from '../i18n/helpers.js';
import { SPEAK_SVG } from '../util.js';

export function dailyCard(w) {
  return (
    '<div class="dcard"><div class="dhead"><span class="kana dk" dir="ltr">' +
    w[0] +
    '</span><button class="btn primary dhear" data-dw="' +
    w[0] +
    '">' +
    SPEAK_SVG.replace('<svg', '<svg width="20" height="20"') +
    ' ' +
    t('card.hear') +
    '</button></div>' +
    '<div class="dro ltr">' +
    w[1] +
    '</div><div class="dmean">' +
    meanOf(w, 'dailyMeanings') +
    '</div>' +
    '<div class="dex"><span class="small muted">' +
    t('daily.ex') +
    '</span><span class="kana dek" dir="ltr">' +
    w[5] +
    '</span><span class="dro ltr">' +
    w[6] +
    '</span><span class="dmean">' +
    dailySentenceMeaning(w) +
    '</span></div></div>'
  );
}
