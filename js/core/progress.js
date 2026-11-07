import { LETTERS, me, normalize, restoreProgress, state, updateProgress } from './store.js';
import { todayISO } from '../util.js';

// These operations own progress changes; screens only read state and invoke actions.
/** @param {import('../../types/app').Progress} progress */
function logActivity(progress) {
  const day = todayISO();
  progress.act[day] = (progress.act[day] || 0) + 1;
}

export const CLEAN_GOAL = 3;
/** @param {string} kana */
export const isComplete = (kana) => !!state.cl[kana];
/** @param {string} kana @returns {import('../../types/app').WriteStats} */
export const writingStats = (kana) => ({ n: 0, p: 0, ...state.ws[kana] });
/** A letter can be completed once it was heard and written cleanly enough times. @param {string} kana */
export const canComplete = (kana) =>
  !isComplete(kana) && (state.heard[kana] ?? 0) > 0 && writingStats(kana).p >= CLEAN_GOAL;

/** @param {string} kana @param {boolean} complete */
export function completeLetter(kana, complete) {
  if (complete && !canComplete(kana)) return;
  updateProgress((progress) => {
    if (complete) progress.cl[kana] = todayISO();
    else delete progress.cl[kana];
  });
}

/** @param {string} kana @param {boolean} clean */
export function recordWrite(kana, clean) {
  updateProgress((progress) => {
    const writes = writingStats(kana);
    writes.n++;
    if (clean) writes.p++;
    progress.ws[kana] = writes;
    logActivity(progress);
  });
}

/** @param {string} kana */
export function recordHeard(kana) {
  if (!me() || !LETTERS().includes(kana)) return;
  updateProgress((progress) => {
    progress.heard[kana] = (progress.heard[kana] || 0) + 1;
  });
}

/**
 * @param {string} kana
 * @param {boolean} correct
 * @param {number} milliseconds
 * @param {string | null} [confusedWith] the letter the answer was mistaken for
 */
export function recordAnswer(kana, correct, milliseconds, confusedWith) {
  updateProgress((progress) => {
    const stats = { b: 0, c: 0, w: 0, t: 0, ...progress.stats[kana] };
    if (correct) {
      stats.c++;
      stats.b = Math.min(5, stats.b + 1);
      if (milliseconds < 15000) {
        stats.t = stats.t
          ? Math.round(stats.t * 0.7 + milliseconds * 0.3)
          : Math.round(milliseconds);
      }
    } else {
      stats.w++;
      stats.b = Math.max(1, stats.b - 2);
      if (confusedWith && confusedWith !== kana && LETTERS().includes(confusedWith)) {
        const key = kana + '>' + confusedWith;
        progress.mix[key] = (progress.mix[key] || 0) + 1;
      }
    }
    progress.stats[kana] = stats;
    logActivity(progress);
  });
}

/** @param {number} count @param {number} percent */
export function recordRound(count, percent) {
  updateProgress((progress) => {
    progress.rounds = [...progress.rounds, { d: todayISO(), n: count, p: percent }].slice(-50);
  });
}

/** @param {number} day @param {boolean} complete */
export function setDayComplete(day, complete) {
  updateProgress((progress) => {
    if (complete) progress.done[day] = todayISO();
    else delete progress.done[day];
  });
}

/** @param {import('../../types/app').ISODate} date */
export function setStartDate(date) {
  updateProgress((progress) => {
    progress.start = date;
  });
}

export function resetProgress() {
  // The stamp lets other devices tell this is a deliberate reset, not progress they should merge back in.
  restoreProgress({ ...normalize(null), reset: Date.now() });
  updateProgress(() => {});
}

/** @param {string[]} ids */
export function awardBadges(ids) {
  if (!ids.length) return;
  // The app's subscriber calculates badges after an action. Do not notify it recursively.
  updateProgress(
    (progress) => {
      ids.forEach((id) => {
        progress.badges[id] = todayISO();
      });
    },
    { notify: false, timestamp: false },
  );
}

/** @param {number} seconds */
export function recordStudyTime(seconds) {
  updateProgress(
    (progress) => {
      const day = todayISO();
      progress.time[day] = (progress.time[day] || 0) + seconds;
    },
    { notify: false, timestamp: false },
  );
}
