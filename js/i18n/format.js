/* keep Latin text (romaji, formulas) the right way round inside Arabic sentences */
export const iso = (s) => '⁦' + s + '⁩';
const PR_AR = new Intl.PluralRules('ar'),
  PR_EN = new Intl.PluralRules('en');
/* Arabic counted nouns: one / two / few (3-10) / many (11-99) / other */
const AR_N = {
  stroke: { one: 'خط واحد', two: 'خطّان', few: '{n} خطوط', many: '{n} خطّاً', other: '{n} خط' },
  phrase: {
    one: 'عبارة واحدة',
    two: 'عبارتان',
    few: '{n} عبارات',
    many: '{n} عبارةً',
    other: '{n} عبارة',
  },
  word: {
    one: 'كلمة واحدة',
    two: 'كلمتان',
    few: '{n} كلمات',
    many: '{n} كلمةً',
    other: '{n} كلمة',
  },
  time: { one: 'مرة واحدة', two: 'مرتان', few: '{n} مرات', many: '{n} مرة', other: '{n} مرة' },
  day: { one: 'يوم واحد', two: 'يومان', few: '{n} أيام', many: '{n} يوماً', other: '{n} يوم' },
  question: {
    one: 'سؤال واحد',
    two: 'سؤالان',
    few: '{n} أسئلة',
    many: '{n} سؤالاً',
    other: '{n} سؤال',
  },
  char: { one: 'حرف واحد', two: 'حرفان', few: '{n} أحرف', many: '{n} حرفاً', other: '{n} حرف' },
  write: {
    one: 'كتابة واحدة',
    two: 'كتابتان',
    few: '{n} كتابات',
    many: '{n} كتابةً',
    other: '{n} كتابة',
  },
};
export const arN = (n, noun) => {
  const f = AR_N[noun],
    c = PR_AR.select(n);
  return (f[c] || f.other).replace('{n}', n);
};
export const enN = (n, one, many) =>
  n + ' ' + (PR_EN.select(n) === 'one' ? one : many || one + 's');
export const K = (s) => '<span class="kana">' + s + '</span>';
