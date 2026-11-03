import { exampleHtml, moreExHtml } from '../core/audio.js';
import { LOOK, rom } from '../data/letters.js';
import { t } from '../i18n/core.js';
import { explain } from '../i18n/helpers.js';

/** Shared learning notes for a letter card and writing practice. @param {string} k */
export function letterNotesHtml(k) {
  let h = '<p class="hook">' + explain(k) + '</p>' + exampleHtml(k) + moreExHtml(k);
  const looks = LOOK[k] || [];
  if (looks.length)
    h +=
      '<p class="small muted">' +
      t('card.mixUp', {
        list: looks
          .map(
            (x) =>
              '<button class="link" type="button" data-open="' +
              x +
              '"><span style="font-family:var(--kana);font-size:18px">' +
              x +
              '</span> (' +
              rom(x) +
              ')</button>',
          )
          .join(t('or')),
      }) +
      '</p>';
  return h;
}
