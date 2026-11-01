/* ---------- learning goals ---------- */
/* Why the person is learning. Each goal points at the phrase sections that matter for it; "all" shows everything.
   The section ids are the ids in the phrase data (data/daily-data.js). */
export const REASONS = ['jlpt', 'travel', 'work', 'school', 'fun', 'all'];
export const GOAL_SECTIONS = {
  jlpt: ['greet', 'polite', 'meet', 'help', 'time', 'phone'],
  travel: ['greet', 'polite', 'help', 'shop', 'food', 'go', 'health', 'time', 'pray'],
  work: ['greet', 'polite', 'meet', 'help', 'hear', 'phone', 'time'],
  school: ['greet', 'polite', 'meet', 'help', 'hear', 'city', 'time'],
  fun: ['greet', 'meet', 'food', 'shop', 'go', 'hear']
};
/* the groups that belong to a goal, in their usual order; every group for "all" */
export const sectionsFor = (reason, groups) => reason === 'all' || !GOAL_SECTIONS[reason] ? groups : groups.filter(g => GOAL_SECTIONS[reason].includes(g.id));
