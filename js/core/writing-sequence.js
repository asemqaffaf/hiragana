/** @type {readonly {guide: boolean, numbers: boolean, label: import('../../types/app').TextKey}[]} */
export const WRITING_PASSES = [
  { guide: true, numbers: true, label: 'write.passGuide' },
  { guide: false, numbers: true, label: 'write.passNumbers' },
  { guide: false, numbers: false, label: 'write.passMemory' },
];

/** @param {import('../../types/app').LessonWritingSequence} sequence */
export const writingSequenceComplete = (sequence) =>
  sequence.index === WRITING_PASSES.length - 1 && sequence.passed;

/** Revoke this step and every later step, preserving earlier passes. @param {import('../../types/app').LessonWritingSequence} sequence */
export function revokeWritingStage(sequence) {
  sequence.completed = Math.min(sequence.completed, sequence.index);
  sequence.passed = false;
}

/** A failed attempt revokes a previous pass. @param {import('../../types/app').LessonWritingSequence} sequence @param {boolean} clean */
export function passWritingStage(sequence, clean) {
  if (!clean) {
    revokeWritingStage(sequence);
    return;
  }
  if (clean && sequence.index <= sequence.completed) {
    sequence.passed = true;
    sequence.completed = Math.max(sequence.completed, sequence.index + 1);
  }
}

/** Revisit a completed step or open the next unlocked step. @param {import('../../types/app').LessonWritingSequence} sequence @param {number} index */
export function selectWritingStage(sequence, index) {
  if (!Number.isInteger(index) || index < 0 || index >= WRITING_PASSES.length || index > sequence.completed) return false;
  sequence.index = index;
  sequence.passed = index < sequence.completed;
  return true;
}

/** @param {import('../../types/app').LessonWritingSequence} sequence */
export function advanceWritingStage(sequence) {
  if (!sequence.passed || writingSequenceComplete(sequence)) return false;
  return selectWritingStage(sequence, sequence.index + 1);
}
