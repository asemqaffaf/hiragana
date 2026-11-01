/* ---------- learning goals ---------- */
/* Why the person is learning. Each goal points at the phrase sections that matter for it; "all" shows everything.
   The section ids are the ids in the phrase data (data/daily-data.js). */
/** @type {readonly import('../../types/app').Reason[]} */
export const REASONS = ['jlpt', 'travel', 'work', 'school', 'fun', 'all'];
/** @type {Record<Exclude<import('../../types/app').Reason, 'all'>, string[]>} */
export const GOAL_SECTIONS = {
  jlpt: ['greet', 'polite', 'meet', 'help', 'time', 'phone'],
  travel: ['greet', 'polite', 'help', 'shop', 'food', 'go', 'health', 'time', 'pray'],
  work: ['greet', 'polite', 'meet', 'help', 'hear', 'phone', 'time'],
  school: ['greet', 'polite', 'meet', 'help', 'hear', 'city', 'time'],
  fun: ['greet', 'meet', 'food', 'shop', 'go', 'hear']
};
/** @type {readonly import('../../types/app').AgeGroup[]} */
export const AGES = ['child', 'teen', 'adult'];
/** @type {readonly import('../../types/app').JapaneseLevel[]} */
export const JLEVELS = ['new', 'some', 'all'];
/** Plan lengths in days. @type {readonly import('../../types/app').Pace[]} */
export const PACES = [7, 14, 21];
/** Minutes a day. @type {readonly import('../../types/app').DailyMinutes[]} */
export const MINUTES = [10, 20, 30];
/* the groups that belong to a goal, in their usual order; every group for "all" */
/** @template {{id: string}} G @param {import('../../types/app').Reason} reason @param {readonly G[]} groups */
export const sectionsFor = (reason, groups) => reason === 'all' || !GOAL_SECTIONS[reason] ? groups : groups.filter(g => GOAL_SECTIONS[reason].includes(g.id));
