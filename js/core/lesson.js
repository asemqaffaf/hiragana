import { dailyFor } from './daily.js';
import { PL, PLEN, curDay, dayNumber, focusKana } from './plan.js';
import { me, state, updateProgress } from './store.js';
import { WRITING_PASSES, revokeWritingStage } from './writing-sequence.js';
import { todayISO } from '../util.js';

/** @type {readonly import('../../types/app').LessonStepId[]} */
export const LESSON_STEP_IDS = ['meet', 'write', 'words', 'read', 'quiz'];
/** @param {unknown} id @returns {id is import('../../types/app').LessonStepId} */
export const isLessonStep = (id) => LESSON_STEP_IDS.some((step) => step === id);

export const lessonOn = () => dayNumber() >= 1 && dayNumber() <= PLEN();

/** The saved progress for a day's lesson, with defaults. @param {number} [day] @returns {import('../../types/app').LessonProgress} */
export function lesson(day = curDay()) {
  return { m: [], w: [], q: -1, r: false, d: [], dd: false, ...state.les[day] };
}

/** The letters written in a lesson: only days with up to ten single letters. @param {number} [day] @returns {string[]} */
export function writeList(day = curDay()) {
  const focus = focusKana(day);
  return focus.length && focus.length <= 10 && focus.every((kana) => kana.length === 1)
    ? focus
    : [];
}

/** @param {number} [day] @returns {import('../../types/app').LessonStep[]} */
export function lessonSteps(day = curDay()) {
  const focus = focusKana(day),
    progress = lesson(day),
    writes = writeList(day);
  /** @type {Omit<import('../../types/app').LessonStep, 'done'>[]} */
  const steps = [];
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

/** The next unfinished activity after a completed step. @param {import('../../types/app').LessonStepId} id @param {number} [day] @returns {import('../../types/app').LessonStepId | null} */
export function nextLessonStep(id, day = curDay()) {
  const steps = lessonSteps(day);
  const index = steps.findIndex((step) => step.id === id);
  return index < 0 ? null : steps.slice(index + 1).find((step) => !step.done)?.id ?? null;
}

/** @param {(lesson: import('../../types/app').LessonProgress) => void} change */
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

/** @param {string} kana */
export function markLetterMet(kana) {
  if (!focusKana(curDay()).includes(kana) || lesson().m.includes(kana)) return;
  updateLesson((progress) => {
    progress.m = [...progress.m, kana];
  });
}

/** @param {string} kana */
export function recordLessonWrite(kana) {
  if (!writeList().includes(kana) || lesson().w.includes(kana)) return;
  updateLesson((progress) => {
    progress.w = [...progress.w, kana];
    if (progress.writingResume === kana) delete progress.writingResume;
  });
}

/** Restore a letter's current step without changing saved progress. @param {string} kana @returns {import('../../types/app').LessonWritingSequence} */
export function lessonWritingSequence(kana) {
  const progress = lesson(), saved = progress.writing?.[kana];
  const completed = saved?.completed ?? (progress.w.includes(kana) ? WRITING_PASSES.length : 0);
  const index = saved?.index ?? Math.min(completed, WRITING_PASSES.length - 1);
  return { studentId: me()?.id || '', day: curDay(), k: kana, index, completed, passed: index < completed };
}

/** @param {import('../../types/app').LessonWritingSequence} sequence */
function validWritingSequence(sequence) {
  return lessonOn() && sequence.studentId === me()?.id && sequence.day === curDay() && writeList().includes(sequence.k) &&
    Number.isInteger(sequence.index) && Number.isInteger(sequence.completed) && sequence.index >= 0 &&
    sequence.index < WRITING_PASSES.length && sequence.completed >= sequence.index && sequence.completed <= WRITING_PASSES.length;
}

/** Save after a successful write or a step change. @param {import('../../types/app').LessonWritingSequence} sequence */
export function saveLessonWriting(sequence) {
  if (!validWritingSequence(sequence)) return;
  updateLesson((progress) => {
    const previous = progress.writing?.[sequence.k];
    progress.writing = { ...progress.writing, [sequence.k]: {
      index: sequence.index, completed: Math.max(previous?.completed ?? 0, sequence.completed),
    } };
    if (!progress.w.includes(sequence.k)) progress.writingResume = sequence.k;
  });
}

/** A new mistake invalidates completion immediately, including saved lesson/day completion. @param {import('../../types/app').LessonWritingSequence} sequence */
export function revokeLessonWriting(sequence) {
  if (!validWritingSequence(sequence)) return;
  revokeWritingStage(sequence);
  updateProgress((progress) => {
    const current = lesson();
    current.writing = { ...current.writing, [sequence.k]: { index: sequence.index, completed: sequence.completed } };
    current.writingResume = sequence.k;
    current.w = current.w.filter((kana) => kana !== sequence.k);
    progress.les[sequence.day] = current;
    delete progress.cl[sequence.k];
    delete progress.done[sequence.day];
  });
}

/** Resume the first unfinished letter; its saved checkpoint restores the writing step. */
export function resumeWritingKana() {
  const progress = lesson(), list = writeList();
  return list.find((kana) => !progress.w.includes(kana)) || list[0];
}

/** Completed letters can be reviewed; future unfinished letters cannot be skipped to. @param {string} kana */
export function canOpenLessonWriting(kana) {
  return writeList().includes(kana) && (lesson().w.includes(kana) || kana === resumeWritingKana());
}

/** Always repair the earliest gap before moving forward. @param {string} kana */
export function nextWritingKana(kana) {
  const completed = lesson().w;
  return writeList().find((letter) => letter !== kana && !completed.includes(letter)) || '';
}

/** @param {string} kana the word, as written in the daily list */
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

/** @param {number} percent */
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
