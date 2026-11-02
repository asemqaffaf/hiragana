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
const passwords = await import('../js/core/passwords.js');
const remembered = await import('../js/core/remembered-login.js');
const storage = await import('../js/core/storage.js');

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
