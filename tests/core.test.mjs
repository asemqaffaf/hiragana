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

let studentNumber = 0;
function student(pace = 14) {
  return store.addStudent(
    { id: String(++studentNumber), name: 'Learner', goal: { pace } },
    { start: todayISO() },
  );
}

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
