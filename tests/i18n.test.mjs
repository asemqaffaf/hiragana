import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = { matchMedia: () => ({ matches: false }) };
const i18n = await import('../js/i18n/core.js');
const helpers = await import('../js/i18n/helpers.js');
const { auditLocale } = await import('../js/i18n/audit.js');
const { cleanStudent } = await import('../js/core/store.js');
const { PL } = await import('../js/core/plan.js');
const { DAILY_ALL, PHRASES } = await import('../js/data/daily.js');
const { EXAMPLES } = await import('../js/data/content.js');
const { wordCard } = await import('../js/ui/word-card.js');

i18n.registerLocale({
  id: 'fr',
  label: 'Français',
  dateLocale: 'fr-FR',
  strings: { 'login.create': 'Créer un profil', 'duration.minutes': '{n} minutes' },
  content: {
    meanings: { いえ: 'maison' },
    phraseMeanings: { いえ: 'chez moi' },
    hooks: { あ: 'Un aide-mémoire' },
    dailySentences: { いえ: 'Je rentre à la maison.' },
    phraseTitles: { greet: 'Salutations' },
    plan: [{ t: 'Première leçon', tasks: [{ text: 'Écoutez.', minutes: 12 }] }],
  },
});
i18n.registerLocale({ id: 'he', label: 'עברית', direction: 'rtl', strings: {} });

test('registration drives detection, direction and saved-student validation', () => {
  assert.equal(i18n.detectLocale(['fr-CA', 'en-US']), 'fr');
  assert.equal(i18n.detectLocale(['de-DE', 'he-IL']), 'he');
  assert.equal(i18n.localeFor('he').direction, 'rtl');
  const student = cleanStudent({ id: 'new', name: 'Learner', lang: 'fr', native: 'fr' });
  assert.equal(student.lang, 'fr');
  assert.equal(student.native, 'fr');
  assert.equal(i18n.replaceLang('unknown'), 'en');
});

test('partial translations fall back to English and interpolate values', () => {
  i18n.replaceLang('fr');
  assert.equal(i18n.t('login.create'), 'Créer un profil');
  assert.equal(i18n.t('plan.dayOf', { n: 2, total: 14 }), 'Day 2 of 14');
  assert.equal(i18n.t('not.a.key'), 'not.a.key');
  i18n.replaceLang('en');
});

test('learning content uses locale dictionaries and English fallbacks', () => {
  i18n.replaceLang('fr');
  assert.equal(helpers.meanOf(DAILY_ALL[0], 'dailyMeanings'), 'maison');
  const phraseMeaning = helpers.meanOf(DAILY_ALL[0], 'phraseMeanings');
  assert.equal(phraseMeaning, 'chez moi');
  assert.ok(wordCard(DAILY_ALL[0], ' open', phraseMeaning).includes('>chez moi</span>'));
  assert.equal(helpers.dailySentenceMeaning(DAILY_ALL[0]), 'Je rentre à la maison.');
  assert.equal(helpers.phraseTitle(PHRASES[0]), 'Salutations');
  assert.equal(helpers.explain('あ'), 'Un aide-mémoire');
  assert.equal(helpers.exampleMeaning('い'), EXAMPLES['い'][2]);
  const plan = PL({ goal: { pace: 14, min: 10 } });
  assert.equal(plan[0].t, 'Première leçon');
  assert.deepEqual(plan[0].tasks, ['Écoutez. (4 minutes)']);
  assert.equal(plan.length, 14);
  assert.equal(typeof plan[1].tasks[0], 'string');
  assert.ok(plan[1].tasks[0].includes('(2 minutes)'));
  i18n.replaceLang('en');
});

test('Arabic meanings and duration formatting retain their existing content', () => {
  i18n.replaceLang('ar');
  assert.equal(helpers.exampleMeaning('あ'), EXAMPLES['あ'][3]);
  assert.equal(helpers.meanOf(DAILY_ALL[0], 'dailyMeanings'), DAILY_ALL[0][3]);
  assert.equal(helpers.dailySentenceMeaning(DAILY_ALL[0]), DAILY_ALL[0][8]);
  assert.equal(helpers.phraseTitle(PHRASES[0]), PHRASES[0].ar);
  const plan = PL({ goal: { pace: 21, min: 10 } });
  assert.equal(plan.length, 21);
  assert.ok(plan[0].tasks[0].endsWith('(3 دقائق)'));
  i18n.replaceLang('en');
});

test('locale audits report missing translations and mismatched placeholders', () => {
  const report = auditLocale('fr');
  assert.ok(report.missing.includes('plan.dayOf'));
  assert.deepEqual(report.mismatched, []);
  i18n.registerLocale({ id: 'zz', label: 'Test', strings: { 'plan.dayOf': 'Day {wrong}' } });
  assert.deepEqual(auditLocale('zz').mismatched, [
    { key: 'plan.dayOf', expected: ['n', 'total'], actual: ['wrong'] },
  ]);
  assert.throws(() => i18n.registerLocale({ id: 'fr', label: 'Duplicate' }), /Duplicate/);
});

test('audits reject broken value types and empty strings use English', () => {
  i18n.registerLocale({
    id: 'xx',
    label: 'Test',
    strings: { 'read.rules': 'This should be an array', 'login.create': '' },
  });
  const report = auditLocale('xx');
  assert.deepEqual(report.invalidTypes, [{ key: 'read.rules', expected: 'array of strings' }]);
  assert.ok(report.missing.includes('login.create'));
  assert.equal(i18n.translate('xx', 'login.create'), i18n.translate('en', 'login.create'));
});
