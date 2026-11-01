import {SENTENCES} from './content.js';
import {DD} from './daily-data.js';

export const DAILY = DD.daily, PHRASES = DD.phrases, EXTRA = DD.extra || {};
/* more reading sentences; their Arabic goes into SENT_AR (i18n.js) */
DD.sentences.forEach(s => SENTENCES.push([s[0], s[1], s[2]]));
export const DAILY_ALL = Object.keys(DAILY).sort((a, b) => a - b).flatMap(b => DAILY[b]);
