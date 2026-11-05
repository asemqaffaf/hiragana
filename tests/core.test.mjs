import assert from 'node:assert/strict';
import { test } from 'node:test';

// The model runs without a DOM. Only the shared reduced-motion constant needs a window shim.
globalThis.window = { matchMedia: () => ({ matches: false }) };
const saved = new Map();
globalThis.localStorage = {
  getItem: (key) => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value),
  removeItem: (key) => saved.delete(key),
};

const store = await import('../js/core/store.js');
const progress = await import('../js/core/progress.js');
const lessons = await import('../js/core/lesson.js');
const plan = await import('../js/core/plan.js');
const { dailyFor } = await import('../js/core/daily.js');
const { todayISO } = await import('../js/util.js');
const { replaceLang } = await import('../js/i18n/core.js');
const pages = await import('../js/core/pages.js');
const practice = await import('../js/core/practice.js');
const passwords = await import('../js/core/passwords.js');
const remembered = await import('../js/core/remembered-login.js');
const storage = await import('../js/core/storage.js');
const writing = await import('../js/core/writing-sequence.js');

test('lesson writing requires guide with numbers, numbers only, then neither', () => {
  assert.deepEqual(writing.WRITING_PASSES.map(({ guide, numbers }) => [guide, numbers]),
    [[true, true], [false, true], [false, false]]);
  const sequence = { studentId: 'learner', day: 1, k: 'あ', index: 0, passed: false, completed: 0 };
  for (let index = 0; index < 3; index++) {
    assert.equal(sequence.index, index);
    assert.equal(writing.writingSequenceComplete(sequence), false);
    writing.passWritingStage(sequence, false);
    assert.equal(writing.advanceWritingStage(sequence), false, 'mistakes require a retry');
    writing.passWritingStage(sequence, true);
    assert.equal(writing.writingSequenceComplete(sequence), index === 2);
    assert.equal(writing.advanceWritingStage(sequence), index < 2);
  }
  assert.equal(sequence.index, 2);
  assert.equal(writing.writingSequenceComplete(sequence), true);
});

test('writing steps allow review without unlocking unfinished future steps', () => {
  const sequence = { studentId: 'learner', day: 1, k: 'あ', index: 0, passed: false, completed: 0 };
  assert.equal(writing.selectWritingStage(sequence, 1), false);
  writing.passWritingStage(sequence, true);
  assert.equal(writing.selectWritingStage(sequence, 1), true);
  assert.equal(sequence.passed, false);
  assert.equal(writing.selectWritingStage(sequence, 2), false);
  assert.equal(writing.selectWritingStage(sequence, 0), true);
  assert.equal(sequence.passed, true);
  writing.passWritingStage(sequence, true);
  assert.equal(sequence.completed, 1, 'repeating a passed step cannot unlock later steps');
  assert.equal(writing.advanceWritingStage(sequence), true);
  assert.equal(sequence.passed, false);
  writing.passWritingStage(sequence, false);
  assert.equal(writing.selectWritingStage(sequence, 2), false);
  writing.passWritingStage(sequence, true);
  assert.equal(writing.selectWritingStage(sequence, 2), true);
  writing.passWritingStage(sequence, true);
  assert.equal(writing.selectWritingStage(sequence, 0), true);
  assert.equal(sequence.completed, 3);
  assert.equal(writing.advanceWritingStage(sequence), true);
  assert.equal(writing.advanceWritingStage(sequence), true);
  assert.equal(writing.writingSequenceComplete(sequence), true);
  for (const index of [-1, 3, 0.5, NaN]) assert.equal(writing.selectWritingStage(sequence, index), false);
});

test('a failed review revokes the current pass and later passes', () => {
  for (const index of [0, 1, 2]) {
    const sequence = { studentId: 'learner', day: 1, k: 'あ', index, passed: true, completed: 3 };
    writing.passWritingStage(sequence, false);
    assert.equal(sequence.passed, false);
    assert.equal(sequence.completed, index);
    assert.equal(writing.advanceWritingStage(sequence), false);
    if (index < 2) assert.equal(writing.selectWritingStage(sequence, index + 1), false);
    writing.passWritingStage(sequence, true);
    assert.equal(sequence.completed, index + 1, 'one clean retry restores just this step');
  }
});

let studentNumber = 0;

test('practice has four optional steps and reviews the current letter’s row', () => {
  assert.deepEqual(practice.PRACTICE_STEPS, ['write', 'read', 'phrases', 'drill']);
  assert.equal(practice.nextPracticeStep('write'), 'read');
  assert.equal(practice.nextPracticeStep('read'), 'phrases');
  assert.equal(practice.nextPracticeStep('phrases'), 'drill');
  assert.equal(practice.nextPracticeStep('drill'), null);
  assert.equal(practice.nextPracticeStep('plan'), null);
  for (const [kana, preset] of [
    ['あ', 'row-a'], ['ぬ', 'row-n'], ['が', 'row-g'], ['ぢ', 'row-d'],
    ['きゃ', 'row-k'], ['ゃ', 'row-y'], ['ゅ', 'row-y'], ['ょ', 'row-y'], ['っ', 'row-t'],
  ]) assert.equal(practice.practiceQuizPreset(kana), preset, kana);
  assert.equal(practice.practiceQuizPreset(''), null);
  assert.equal(practice.practiceQuizPreset('?'), null);
});
function student(pace = 14) {
  return store.addStudent(
    { id: String(++studentNumber), name: 'Learner', goal: { pace } },
    { start: todayISO() },
  );
}

test('writing checkpoints survive reload, import, review and student switching', () => {
  const first = student(21), kana = lessons.writeList()[1];
  const sequence = lessons.lessonWritingSequence(kana);
  writing.passWritingStage(sequence, true);
  writing.advanceWritingStage(sequence);
  lessons.saveLessonWriting(sequence);
  const persisted = store.loadProgress(first.id);
  store.restoreProgress(persisted);
  assert.deepEqual(lessons.lessonWritingSequence(kana), sequence);
  assert.equal(lessons.resumeWritingKana(), kana);
  assert.equal(lessons.lesson().w.includes(kana), false, 'a checkpoint is not letter completion');
  writing.selectWritingStage(sequence, 0);
  lessons.saveLessonWriting(sequence);
  assert.equal(lessons.lessonWritingSequence(kana).completed, 1);
  assert.equal(lessons.lessonWritingSequence(kana).index, 0);
  student(21);
  lessons.saveLessonWriting(sequence);
  assert.equal(lessons.lessonWritingSequence(kana).completed, 0, 'another student cannot inherit or save this checkpoint');
  store.selectStudent(first.id);
  assert.equal(lessons.lessonWritingSequence(kana).completed, 1);
  progress.setStartDate('2026-01-01');
  lessons.saveLessonWriting(sequence);
  assert.equal(store.state.les[plan.curDay()], undefined, 'a stale lesson day cannot save a checkpoint');
});

test('imported writing checkpoints are bounded and legacy lesson records still load', () => {
  const cleaned = store.normalize({ les: { 1: {
    writing: { 'あ': { index: 100, completed: 100 }, 'い': { index: -4, completed: -1 }, 'う': { index: 2, completed: 0 }, invalid: { index: 1, completed: 3 } },
    writingResume: 'invalid',
  } } });
  assert.deepEqual(cleaned.les[1].writing, {
    'あ': { index: 2, completed: 3 }, 'い': { index: 0, completed: 0 }, 'う': { index: 0, completed: 0 },
  });
  assert.equal(cleaned.les[1].writingResume, undefined);
  const legacy = store.normalize({ les: { 1: { w: ['あ'] } } });
  assert.deepEqual(legacy.les[1].w, ['あ']);
  assert.equal(legacy.les[1].writing, undefined);
});

test('writing moves to unfinished letters before continuing the lesson', () => {
  student(21);
  const list = lessons.writeList();
  assert.equal(lessons.nextWritingKana(list.at(-1)), list[0], 'jumping to the last letter cannot skip earlier letters');
  for (const kana of list.slice(0, -1)) lessons.recordLessonWrite(kana);
  assert.equal(lessons.nextWritingKana(list.at(-1)), '');
  lessons.recordLessonWrite(list.at(-1));
  assert.equal(lessons.nextLessonStep('write'), 'words');
  lessons.completeLessonWords();
  assert.equal(lessons.nextLessonStep('write'), 'quiz');
  lessons.recordLessonQuiz(100);
  assert.equal(lessons.nextLessonStep('write'), null);
});

test('revocation clears saved letter and day completion and survives reload', () => {
  const learner = student(21), list = lessons.writeList(), kana = list[0];
  for (const letter of plan.focusKana(plan.curDay())) lessons.markLetterMet(letter);
  for (const letter of list) lessons.recordLessonWrite(letter);
  lessons.completeLessonWords();
  lessons.recordLessonQuiz(100);
  for (let i = 0; i < 3; i++) progress.recordWrite(kana, true);
  progress.recordHeard(kana);
  progress.completeLetter(kana, true);
  assert.ok(store.state.done[1]);
  const sequence = lessons.lessonWritingSequence(kana);
  writing.selectWritingStage(sequence, 1);
  lessons.revokeLessonWriting(sequence);
  assert.equal(sequence.completed, 1);
  assert.equal(sequence.passed, false);
  assert.equal(progress.isComplete(kana), false);
  assert.equal(lessons.lesson().w.includes(kana), false);
  assert.equal(store.state.done[1], undefined);
  assert.deepEqual(lessons.lesson().w, list.slice(1));
  assert.equal(lessons.lesson().dd, true, 'other activities retain progress');
  assert.equal(progress.writingStats(kana).p, 3, 'historical writing statistics are retained');
  store.restoreProgress(store.loadProgress(learner.id));
  const restored = lessons.lessonWritingSequence(kana);
  assert.equal(restored.completed, 1);
  assert.equal(restored.passed, false);
  assert.equal(writing.selectWritingStage(restored, 2), false);
  assert.equal(lessons.resumeWritingKana(), kana);
  for (let i = 1; i < 3; i++) {
    writing.passWritingStage(restored, true);
    lessons.saveLessonWriting(restored);
    writing.advanceWritingStage(restored);
  }
  progress.completeLetter(kana, true);
  lessons.recordLessonWrite(kana);
  assert.ok(store.state.done[1]);
  assert.equal(progress.isComplete(kana), true);
  const another = student(21);
  lessons.revokeLessonWriting(restored);
  assert.equal(store.state.les[1], undefined, 'a stale student cannot revoke another student’s progress');
  assert.notEqual(another.id, learner.id);
});

test('finishing introductions continues to the next unfinished lesson activity', () => {
  student(21);
  assert.equal(lessons.nextLessonStep('meet'), 'write');
  for (const kana of lessons.writeList()) lessons.recordLessonWrite(kana);
  assert.equal(lessons.nextLessonStep('meet'), 'words', 'completed writing is skipped');
  lessons.completeLessonWords();
  assert.equal(lessons.nextLessonStep('meet'), 'quiz');
  lessons.recordLessonQuiz(95);
  assert.equal(lessons.nextLessonStep('meet'), null, 'no pending activities returns to Today');
  assert.equal(lessons.nextLessonStep('quiz'), null);
  const noWritingDay = Array.from({ length: plan.PLEN() }, (_, i) => i + 1)
    .find((day) => lessons.writeList(day).length === 0 && plan.focusKana(day).length > 0);
  assert.ok(noWritingDay);
  assert.notEqual(lessons.nextLessonStep('meet', noWritingDay), 'write', 'unavailable writing is skipped');
});

test('answers persist accuracy and confusion together, with one notification', () => {
  const learner = student();
  let notifications = 0;
  const unsubscribe = store.subscribeProgress(() => {
    notifications++;
  });
  progress.recordAnswer('あ', false, 1200, 'お');
  const persisted = JSON.parse(saved.get('hiragana14-progress-' + learner.id));
  assert.equal(persisted.stats['あ'].w, 1);
  assert.equal(persisted.mix['あ>お'], 1);
  assert.equal(persisted.act[todayISO()], 1);
  assert.equal(notifications, 1);
  unsubscribe();
});

test('letter completion requires hearing and three clean writes', () => {
  student();
  progress.completeLetter('あ', true);
  assert.equal(progress.isComplete('あ'), false);
  for (let i = 0; i < 3; i++) progress.recordWrite('あ', true);
  assert.equal(progress.canComplete('あ'), false);
  progress.recordHeard('あ');
  assert.equal(progress.canComplete('あ'), true);
  progress.completeLetter('あ', true);
  assert.equal(progress.isComplete('あ'), true);
  progress.completeLetter('あ', false);
  assert.equal(progress.isComplete('あ'), false);
});

test('lesson completion is saved by actions without rendering, for every pace and language', () => {
  for (const language of ['en', 'ar']) {
    replaceLang(language);
    for (const pace of [7, 14, 21]) {
      const learner = student(pace);
      for (const kana of plan.focusKana(plan.curDay())) lessons.markLetterMet(kana);
      for (const kana of lessons.writeList()) lessons.recordLessonWrite(kana);
      for (const word of dailyFor(plan.curDay())) lessons.recordLessonWord(word[0]);
      lessons.recordLessonQuiz(80);
      assert.equal(store.state.done[1], undefined);
      lessons.recordLessonQuiz(100);
      assert.equal(store.state.done[1], todayISO());
      const persisted = JSON.parse(saved.get('hiragana14-progress-' + learner.id));
      assert.equal(persisted.done[1], todayISO());
      const before = JSON.stringify(store.state);
      lessons.lessonSteps();
      assert.equal(
        JSON.stringify(store.state),
        before,
        'Reading lesson steps must not change progress',
      );
    }
  }
  replaceLang('en');
});

test('student switching and legacy progress retain the existing storage format', () => {
  const first = student();
  progress.recordAnswer('あ', true, 800);
  const second = student();
  assert.equal(store.state.stats['あ'], undefined);
  store.selectStudent(first.id);
  assert.equal(store.state.stats['あ'].c, 1);
  assert.equal(store.state.stats['あ'].t, 800);
  store.selectStudent(second.id);
  assert.equal(store.state.stats['あ'], undefined);
  store.removeStudent(first.id);
  assert.equal(saved.has('hiragana14-progress-' + first.id), false);
});

test('badge persistence cannot recursively notify progress subscribers', () => {
  student();
  let notifications = 0;
  const unsubscribe = store.subscribeProgress(() => {
    notifications++;
    progress.awardBadges(['first']);
  });
  progress.recordAnswer('あ', true, 1000);
  assert.equal(notifications, 1);
  assert.equal(store.state.badges.first, todayISO());
  unsubscribe();
});

test('rendering a page does not run its entry action', () => {
  let entries = 0,
    renders = 0;
  pages.registerPages({ meet: { enter: () => entries++, render: () => renders++ } });
  pages.enterPage('meet');
  pages.renderPage('meet');
  assert.equal(entries, 1);
  assert.equal(renders, 2);
});

test('remembered sign-in expires without renewal and rejects missing or changed credentials', async () => {
  const learner = student();
  assert.equal(remembered.rememberLogin(learner.id), false, 'legacy profiles must first enroll a password');
  await passwords.setPassword(learner.id, 'Remember-test-password-2026');
  assert.equal(remembered.rememberedStudent(), null, 'setting a password does not opt in');
  assert.equal(remembered.rememberLogin(learner.id), true);
  const login = storage.readRememberedLogin();
  assert.equal(remembered.rememberedStudent(), learner.id);
  assert.deepEqual(storage.readRememberedLogin(), login, 'restoring never extends expiry');
  storage.writeRememberedLogin({ ...login, expiresAt: Date.now() - 1 });
  assert.equal(remembered.rememberedStudent(), null);
  assert.equal(storage.readRememberedLogin(), null);
  for (const corrupt of [[], 'bad', { id: learner.id }, { ...login, expiresAt: Date.now() + 2 * remembered.REMEMBER_LOGIN_MS }]) {
    saved.set('hiragana14-remembered-login-v1', JSON.stringify(corrupt));
    assert.equal(remembered.rememberedStudent(), null);
  }
  remembered.rememberLogin(learner.id);
  const secret = storage.readSyncSecret(learner.id);
  saved.delete('hiragana14-sync-' + learner.id);
  assert.equal(remembered.rememberedStudent(), null);
  storage.writeSyncSecret(learner.id, secret);
  remembered.rememberLogin(learner.id);
  storage.writePasswordVerifier(learner.id, 'changed-verifier');
  assert.equal(remembered.rememberedStudent(), null);
});

test('sign-out, profile removal and local password changes forget remembered sign-in', async () => {
  const first = student();
  await passwords.setPassword(first.id, 'Remember-test-password-2026');
  remembered.rememberLogin(first.id);
  const second = student();
  store.removeStudent(second.id);
  assert.equal(remembered.rememberedStudent(), first.id, 'removing another profile leaves the remembered login');
  store.clearCurrentStudent();
  assert.equal(remembered.rememberedStudent(), null);
  remembered.rememberLogin(first.id);
  await passwords.setPassword(first.id, 'Changed-test-password-2026');
  assert.equal(remembered.rememberedStudent(), null);
  remembered.rememberLogin(first.id);
  await passwords.rememberPassword(first.id, await passwords.passwordSecret(first.id, 'Cloud-test-password-2026'));
  assert.equal(remembered.rememberedStudent(), null, 'cloud login or password reset invalidates the prior record');
  remembered.rememberLogin(first.id);
  store.removeStudent(first.id);
  assert.equal(remembered.rememberedStudent(), null);
});

test('theme defaults to slate (Grey) and TINTS order switches Grey and Sage', () => {
  assert.equal(store.TINTS[0], 'slate');
  assert.equal(store.TINTS[5], 'sage');
  assert.deepEqual(store.cleanTheme({}), { mode: 'system', tint: 'slate' });
  assert.deepEqual(store.cleanTheme({ tint: 'sage' }), { mode: 'system', tint: 'sage' });
  assert.deepEqual(store.cleanTheme({ tint: 'unknown' }), { mode: 'system', tint: 'slate' });
});
