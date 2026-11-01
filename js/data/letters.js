/** @type {import('../../types/app').KanaRow[]} */
export const ROWS = [
  {id:'a', kana:['あ','い','う','え','お']},
  {id:'k', kana:['か','き','く','け','こ']},
  {id:'s', kana:['さ','し','す','せ','そ']},
  {id:'t', kana:['た','ち','つ','て','と']},
  {id:'n', kana:['な','に','ぬ','ね','の']},
  {id:'h', kana:['は','ひ','ふ','へ','ほ']},
  {id:'m', kana:['ま','み','む','め','も']},
  {id:'y', kana:['や',null,'ゆ',null,'よ']},
  {id:'r', kana:['ら','り','る','れ','ろ']},
  {id:'w', kana:['わ',null,null,null,'を']},
  {id:'nn', kana:['ん',null,null,null,null]}
];
/** @type {import('../../types/app').VoicedRow[]} */
export const DROWS = [
  {id:'g', base:'k', kana:['が','ぎ','ぐ','げ','ご']},
  {id:'z', base:'s', kana:['ざ','じ','ず','ぜ','ぞ']},
  {id:'d', base:'t', kana:['だ','ぢ','づ','で','ど']},
  {id:'b', base:'h', kana:['ば','び','ぶ','べ','ぼ']},
  {id:'p', base:'h', kana:['ぱ','ぴ','ぷ','ぺ','ぽ']}
];
/** @type {string[]} */
export const YBASE = ['き','し','ち','に','ひ','み','り','ぎ','じ','び','ぴ'];
const SMALL = ['ゃ','ゅ','ょ'];
/** @type {import('../../types/app').YoonRow[]} */
export const YROWS = YBASE.map(b => ({id:'y-'+b, base:b, kana:SMALL.map(s => b+s)}));
/** @type {Record<string, string>} */
const RTXT = {
  'あ':'a','い':'i','う':'u','え':'e','お':'o',
  'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
  'さ':'sa','し':'shi|si','す':'su','せ':'se','そ':'so',
  'た':'ta','ち':'chi|ti','つ':'tsu|tu','て':'te','と':'to',
  'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
  'は':'ha','ひ':'hi','ふ':'fu|hu','へ':'he','ほ':'ho',
  'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
  'や':'ya','ゆ':'yu','よ':'yo',
  'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
  'わ':'wa','を':'o|wo','ん':'n|nn',
  'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
  'ざ':'za','じ':'ji|zi','ず':'zu','ぜ':'ze','ぞ':'zo',
  'だ':'da','ぢ':'ji|di','づ':'zu|du','で':'de','ど':'do',
  'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
  'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po'
};
/** Accepted romaji spellings per kana; the first one is shown. @type {Record<string, string[]>} */
export const R = {};
for (const k in RTXT) R[k] = RTXT[k].split('|');
/** @type {Record<string, string[][]>} */
const YSPECIAL = {
  'し':[['sha','sya'],['shu','syu'],['sho','syo']],
  'ち':[['cha','tya','cya'],['chu','tyu','cyu'],['cho','tyo','cyo']],
  'じ':[['ja','zya','jya'],['ju','zyu','jyu'],['jo','zyo','jyo']]
};
for (const b of YBASE) {
  const c = R[b][0].slice(0, -1);
  SMALL.forEach((s, i) => {
    R[b+s] = YSPECIAL[b] ? YSPECIAL[b][i] : [c + 'y' + ['a','u','o'][i]];
  });
}
R['ゃ'] = ['ya'];
 R['ゅ'] = ['yu'];
 R['ょ'] = ['yo'];
 R['っ'] = ['(pause)'];
/** @type {Record<string, string>} */
const DISP = {'を':'(w)o'};
/** The romaji shown for a kana. @param {string} k */
export const rom = k => DISP[k] || R[k][0];
/** @param {string | null} k @returns {k is string} */
const isKana = k => k !== null;
/** The letters that exist in a row (the や and わ rows have gaps). @param {{kana: (string | null)[]}} row @returns {string[]} */
export const kanaOf = row => row.kana.filter(isKana);
/** @type {string[]} */
export const A46 = ROWS.flatMap(kanaOf);
/** @type {string[]} */
export const DAK25 = DROWS.flatMap(r => r.kana);
/** @type {string[]} */
export const YOON33 = YROWS.flatMap(r => r.kana);
/** @type {string[]} */
export const ALL = [...A46, ...DAK25, ...YOON33];
/** @type {Record<string, string>} */
const HOOK = {
  'あ':"A cross, then one big loop: a lowercase \"a\" is hiding inside. Ah!",
  'い':"Two eels standing side by side: \"ee\". The left one is taller and hooks at the bottom.",
  'う':"Someone doubled over with a stomach ache: \"uuu\". The dash on top is the head.",
  'え':"A bird on a perch: dash for the head, a zig-zag body, a wavy tail. \"Eh?\"",
  'お':"Like あ, but with a small dash popping off at the top right. \"Oh! A piece broke off.\"",
  'か':"A karate chop with a spark flying off to the right: \"KA!\"",
  'き':"A key: two bars, a shaft through them, and the teeth curling at the bottom. When you write it, the bottom stroke is separate.",
  'く':"An open beak going \"coo\".",
  'け':"A keg: the left post is the stand, the right side is the barrel with a long tap.",
  'こ':"Two koi fish, one swimming above the other.",
  'さ':"It is き with one bar missing. The key lost a bar and is sad: \"sa\".",
  'し':"A fishing hook. She is fishing: \"shi\".",
  'す':"A swing hanging from a bar, with the seat looped once: \"su-wing\".",
  'せ':"A table being set: the bar is the top, two legs, and one leg bends round underneath. \"Set\".",
  'そ':"A thread zig-zagging through fabric: \"sew\".",
  'た':"Spell it out: a \"t\" on the left, and two small strokes on the right. t + a.",
  'ち':"A 5 with its top bar crossing through: \"chi\". The belly curves out to the right. さ's bottom is a separate small cup instead.",
  'つ':"One curling wave: tsunami.",
  'て':"A capital T bent over by the wind: \"te\".",
  'と':"A toe with a splinter in it: \"to\".",
  'な':"A cross, a dot, and a string tied into a knot at the bottom: \"na\" for knot.",
  'に':"The kanji 二 (two), which is read \"ni\", with a post beside it.",
  'ぬ':"Noodles on chopsticks, with a loop at the end: \"nu-dles\". め is the same without the end loop.",
  'ね':"A cat (neko) with its tail curled into a loop: \"ne\".",
  'の':"A no-entry sign: one round stroke with a slash through it. \"No\".",
  'は':"A post and a laughing mouth: \"ha ha\". As the topic particle it is read \"wa\".",
  'ひ':"A wide grin: \"hee hee\".",
  'ふ':"Mount Fuji: the peak in the middle, a cloud on each side. \"Fu\", said with the lips only, no teeth.",
  'へ':"A small hill: \"Hey, up here!\" As the direction particle it is read \"e\".",
  'ほ':"は wearing a hat: one extra bar on top. \"Ho ho ho\".",
  'ま':"A mast with two sails and a mooring loop at the bottom: \"ma\". It is the right half of ほ.",
  'み':"Looks like the number 21: \"me\" at 21.",
  'む':"A cow: the loop is its face, the dot is its ear. \"Moo\".",
  'め':"An eye (目, read \"me\"): the loop is the eyeball. ぬ is the same with an extra loop at the end.",
  'も':"A fishing hook with two worms on it, to catch more fish: \"mo\".",
  'や':"A yak's head with its horns: \"ya\".",
  'ゆ':"Printed on the curtain of every public bath (sento). ゆ (湯) means hot water: \"yu\".",
  'よ':"A yo-yo: a short bar, and a string ending in a loop.",
  'ら':"A rabbit sitting: a dash for the ear, a straight back, a round belly. \"Ra\".",
  'り':"Two reeds by a river: \"ri\". Like い, but the right stroke drops much lower.",
  'る':"A road with a roundabout at the end: \"ru\". ろ is the same road with no loop.",
  'れ':"A post with a leg kicking out to the right: \"re\". ね curls into a loop, わ curves round, れ kicks out.",
  'ろ':"A road that bends and stops, no loop: \"ro\".",
  'わ':"A whale's back rounding off on the right: \"wa\".",
  'を':"Only used as the object particle, and read \"o\" like お. Someone tripping forward: \"whoa\".",
  'ん':"A cursive lowercase n. The only basic hiragana with no vowel sound."
};
/** @type {Record<string, string[]>} */
export const LOOK = {
  'あ':['お'],'お':['あ'],'め':['ぬ'],'ぬ':['め'],'ね':['れ','わ'],'れ':['ね','わ'],'わ':['ね','れ'],
  'る':['ろ'],'ろ':['る'],'さ':['ち','き'],'ち':['さ'],'き':['さ'],'い':['り','こ'],'り':['い'],
  'こ':['い','に'],'に':['こ'],'は':['ほ','け'],'ほ':['は','ま'],'け':['は'],'う':['ら','つ'],
  'ら':['う'],'し':['つ'],'つ':['し','う'],'く':['へ'],'へ':['く'],'ま':['も','ほ'],'も':['ま'],
  'た':['な'],'な':['た'],'す':['む'],'む':['す']
};
export const LOOKSET = A46.filter(k => LOOK[k]);
export const NOSOUNDQ = ['を','ぢ','づ'];
/** @type {Record<string, string>} */
const DRULE = {
  g:"The two small dashes (dakuten) make k voiced: k becomes g.",
  z:"The dakuten makes s voiced: s becomes z.",
  d:"The dakuten makes t voiced: t becomes d.",
  b:"The dakuten makes h voiced: h becomes b.",
  p:"The small circle (handakuten) turns h into p. It is the only row that takes ゜."
};
/** @type {Record<string, string>} */
const DNOTE = {
  'じ':"Read \"ji\", not \"zi\".",
  'ぢ':"Sounds exactly like じ (ji). Rare: you will meet it in a few words such as はなぢ (nosebleed).",
  'づ':"Sounds exactly like ず (zu). Rare: for example つづく (to continue)."
};
/**
 * The plain-row letter a voiced letter is built from.
 * @param {string} k
 * @returns {{row: import('../../types/app').VoicedRow, base: string} | null}
 */
export function baseOf(k) {
  for (const r of DROWS) {
    const i = r.kana.indexOf(k);
    const base = i >= 0 ? ROWS.find(x => x.id === r.base)?.kana[i] : null;
    if (base) return {row:r, base};
  }
  return null;
}
/** The full-size letter that a small ゃ ゅ ょ is the small version of. @type {Record<string, string>} */
export const FULL_SIZE = {'ゃ':'や','ゅ':'ゆ','ょ':'よ'};
/** @param {string} k */
export function explainEn(k) {
  if (HOOK[k]) return HOOK[k];
  const d = baseOf(k);
  if (d) return d.base + " (" + rom(d.base) + ") + " + (d.row.id === 'p' ? "゜" : "゛") + " = " + k + " (" + rom(k) + "). " + DRULE[d.row.id] + (DNOTE[k] ? " " + DNOTE[k] : "");
  if (k.length === 2) {
    const b = k[0], s = k[1], big = FULL_SIZE[s];
    return b + " (" + rom(b) + ") + small " + s + " = " + k + " (" + rom(k) + "), said as one beat. Written full size, " + b + big + " would be two beats: " + rom(b) + "-" + rom(big) + ".";
  }
  return "";
}
