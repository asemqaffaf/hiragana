import { dailyFor } from './daily.js';
import { PL, PLEN, curDay, dayNumber, focusKana } from './plan.js';
import { state, updateProgress } from './store.js';
import { todayISO } from '../util.js';

export const lessonOn = () => dayNumber() >= 1 && dayNumber() <= PLEN();

export function lesson(day = curDay()) {
  return { m: [], w: [], q: -1, r: false, d: [], dd: false, ...state.les[day] };
}

export function writeList(day = curDay()) {
  const focus = focusKana(day);
  return focus.length && focus.length <= 10 && focus.every((kana) => kana.length === 1)
    ? focus
    : [];
}

export function lessonSteps(day = curDay()) {
  const focus = focusKana(day),
    progress = lesson(day),
    writes = writeList(day),
    steps = [];
  if (focus.length)
    steps.push({
      id: 'meet',
      n: focus.filter((kana) => progress.m.includes(kana)).length,
      m: focus.length,
    });
  if (writes.length)
    steps.push({
      id: 'write',
      n: writes.filter((kana) => progress.w.includes(kana)).length,
      m: writes.length,
    });
  const words = dailyFor(day);
  if (words.length)
    steps.push({
      id: 'words',
      n: progress.dd ? words.length : words.filter((word) => progress.d.includes(word[0])).length,
      m: words.length,
    });
  if (PL()[day - 1].base.some((base) => base >= 10 && base <= 12))
    steps.push({ id: 'read', n: progress.r ? 1 : 0, m: 1 });
  steps.push({ id: 'quiz', n: progress.q >= 90 ? 1 : 0, m: 1, score: progress.q });
  return steps.map((step) => ({ ...step, done: step.n >= step.m }));
}

function updateLesson(change) {
  if (!lessonOn()) return;
  const day = curDay();
  updateProgress((progress) => {
    const current = lesson(day);
    change(current);
    progress.les[day] = current;
    if (!progress.done[day] && lessonSteps(day).every((step) => step.done)) {
      progress.done[day] = todayISO();
    }
  });
}

export function markLetterMet(kana) {
  if (!focusKana(curDay()).includes(kana) || lesson().m.includes(kana)) return;
  updateLesson((progress) => {
    progress.m = [...progress.m, kana];
  });
}

export function recordLessonWrite(kana) {
  if (!writeList().includes(kana) || lesson().w.includes(kana)) return;
  updateLesson((progress) => {
    progress.w = [...progress.w, kana];
  });
}

export function recordLessonWord(kana) {
  if (!dailyFor(curDay()).some((word) => word[0] === kana) || lesson().d.includes(kana)) return;
  updateLesson((progress) => {
    progress.d = [...progress.d, kana];
  });
}

export function completeLessonWords() {
  if (!lesson().dd)
    updateLesson((progress) => {
      progress.dd = true;
    });
}

export function recordLessonReading() {
  if (!lesson().r)
    updateLesson((progress) => {
      progress.r = true;
    });
}

export function recordLessonQuiz(percent) {
  updateLesson((progress) => {
    progress.q = Math.max(progress.q, percent);
  });
}

// Reconcile existing/imported records at login, rather than mutating them during rendering.
export function reconcileLessonCompletion() {
  if (lessonOn() && !state.done[curDay()] && lessonSteps().every((step) => step.done)) {
    updateLesson(() => {});
  }
}
