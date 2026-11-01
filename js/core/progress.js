import { LETTERS, me, normalize, restoreProgress, state, updateProgress } from './store.js';
import { todayISO } from '../util.js';

// These operations own progress changes; screens only read state and invoke actions.
function logActivity(progress) {
  const day = todayISO();
  progress.act[day] = (progress.act[day] || 0) + 1;
}

export const CLEAN_GOAL = 3;
export const isComplete = (kana) => !!state.cl[kana];
export const writingStats = (kana) => ({ n: 0, p: 0, ...state.ws[kana] });
export const canComplete = (kana) =>
  !isComplete(kana) && state.heard[kana] > 0 && writingStats(kana).p >= CLEAN_GOAL;

export function completeLetter(kana, complete) {
  if (complete && !canComplete(kana)) return;
  updateProgress((progress) => {
    if (complete) progress.cl[kana] = todayISO();
    else delete progress.cl[kana];
  });
}

export function recordWrite(kana, clean) {
  updateProgress((progress) => {
    const writes = writingStats(kana);
    writes.n++;
    if (clean) writes.p++;
    progress.ws[kana] = writes;
    logActivity(progress);
  });
}

export function recordHeard(kana) {
  if (!me() || !LETTERS().includes(kana)) return;
  updateProgress((progress) => {
    progress.heard[kana] = (progress.heard[kana] || 0) + 1;
  });
}

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

export function recordRound(count, percent) {
  updateProgress((progress) => {
    progress.rounds = [...progress.rounds, { d: todayISO(), n: count, p: percent }].slice(-50);
  });
}

export function setDayComplete(day, complete) {
  updateProgress((progress) => {
    if (complete) progress.done[day] = todayISO();
    else delete progress.done[day];
  });
}

export function setStartDate(date) {
  updateProgress((progress) => {
    progress.start = date;
  });
}

export function resetProgress() {
  restoreProgress(normalize(null));
  updateProgress(() => {});
}

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

export function recordStudyTime(seconds) {
  updateProgress(
    (progress) => {
      const day = todayISO();
      progress.time[day] = (progress.time[day] || 0) + seconds;
    },
    { notify: false, timestamp: false },
  );
}
