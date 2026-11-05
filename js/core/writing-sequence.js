/** @type {readonly {guide: boolean, numbers: boolean, label: import('../../types/app').TextKey}[]} */
export const WRITING_PASSES = [
  { guide: true, numbers: true, label: 'write.passGuide' },
  { guide: false, numbers: true, label: 'write.passNumbers' },
  { guide: false, numbers: false, label: 'write.passMemory' },
];

/** @param {import('../../types/app').LessonWritingSequence} sequence */
export const writingSequenceComplete = (sequence) =>
  sequence.index === WRITING_PASSES.length - 1 && sequence.passed;

/** A failed attempt never advances the sequence. @param {import('../../types/app').LessonWritingSequence} sequence @param {boolean} clean */
export function passWritingStage(sequence, clean) {
  if (clean) sequence.passed = true;
}

/** @param {import('../../types/app').LessonWritingSequence} sequence */
export function advanceWritingStage(sequence) {
  if (!sequence.passed || writingSequenceComplete(sequence)) return false;
  sequence.index++;
  sequence.passed = false;
  return true;
}
