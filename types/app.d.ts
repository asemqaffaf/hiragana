/* Shared domain types. Development only: the app is plain JavaScript checked with `npm run typecheck`
   (JSDoc + tsc --noEmit), and nothing here is served or imported at runtime. */

/** A single hiragana, or a small-kana combination such as きゃ. */
export type Kana = string;
/** YYYY-MM-DD */
export type ISODate = string;
/** A registered language tag such as `en` or `ar`. */
export type LocaleId = string;
export type RowId = string;

/* ---------- navigation ---------- */
export type TabName =
  | 'plan'
  | 'meet'
  | 'daily'
  | 'progress'
  | 'chart'
  | 'drill'
  | 'write'
  | 'read'
  | 'phrases'
  | 'profile';
/** The bottom tab bar groups several pages. */
export type NavGroup = 'home' | 'letters' | 'practice' | 'progress' | 'profile';
export type SheetCloseMode = 'replace' | 'pop' | 'nav' | 'silent' | 'dragged';

export interface ShowTabOptions {
  initial?: boolean;
  replace?: boolean;
  fromHistory?: boolean;
  root?: boolean;
  letter?: string | null;
}

export interface PageDefinition {
  render: () => void;
  enter?: (opts: ShowTabOptions) => void;
  shouldRender?: () => boolean;
}
export type PageRegistry = Record<TabName, PageDefinition>;

/* ---------- letters ---------- */
export interface KanaRow {
  id: RowId;
  kana: (Kana | null)[];
}
export interface VoicedRow {
  id: RowId;
  base: RowId;
  kana: Kana[];
}
export interface YoonRow {
  id: string;
  base: Kana;
  kana: Kana[];
}
export interface WriteGroup {
  id: string;
  label: string;
  kana: Kana[];
}
export type PoolName = 'sofar' | 'a46' | 'all';

/* ---------- plan and content ---------- */
export interface Task {
  text: string;
  /** Scaled to the daily minutes and formatted through `duration.minutes`. */
  minutes?: number;
}
export interface BasePlanDay {
  t: string;
  f: RowId[];
  pool?: PoolName;
  tasks: Task[];
}
/** A plan day after pace and daily minutes are applied. */
export interface PlanDay {
  t: string;
  tasks: string[];
  /** Row ids whose letters are new on this day. */
  f: RowId[];
  pool?: PoolName;
  /** The base days (1-14) this day covers; empty for a review day. */
  base: number[];
  review?: boolean;
}
export interface LocalePlanDay {
  t?: string;
  tasks?: (Task | string)[];
}
export interface ReviewDay {
  t: string;
  tasks: Task[];
}

/** [kana, romaji, English meaning] */
export type Word = readonly [kana: string, romaji: string, meaning: string];
export interface WordGroup {
  id: string;
  title: string;
  /** Plan day the group opens on. */
  from: number;
  items: readonly Word[];
}
/** [Japanese, romaji, English] */
export type Sentence = readonly [ja: string, romaji: string, meaning: string];
/** [word, romaji, English, Arabic] */
export type ExampleWord = readonly [ja: string, romaji: string, en: string, ar: string];
/** [kana, romaji, English, Arabic, kanji, sentence, sentence romaji, sentence English, sentence Arabic, sentence kanji] */
export type DailyWord = readonly [
  kana: string,
  romaji: string,
  en: string,
  ar: string,
  kanji: string,
  sentence: string,
  sentenceRomaji: string,
  sentenceEn: string,
  sentenceAr: string,
  sentenceKanji: string,
];
/** [kana, romaji, English, Arabic, kanji] */
export type ExtraWord = readonly [
  kana: string,
  romaji: string,
  en: string,
  ar: string,
  kanji: string,
];
/** [phrase, romaji, English, Arabic, kanji] */
export type Phrase = readonly [
  ja: string,
  romaji: string,
  en: string,
  ar: string,
  kanji: string,
];
export interface PhraseGroup {
  id: string;
  en: string;
  ar: string;
  items: readonly Phrase[];
}
export interface DailyData {
  daily: Record<string, readonly DailyWord[]>;
  phrases: readonly PhraseGroup[];
  extra?: Record<Kana, readonly ExtraWord[]>;
  sentences: readonly (readonly [string, string, string, string, string])[];
}
export interface StrokeData {
  /** SVG path data, one entry per stroke. */
  p: string[];
  /** Stroke number labels: [x, y] */
  n: [number, number][];
}

/* ---------- locales ---------- */
/** Values substituted for `{name}` placeholders. */
export type Interpolation = Record<string, string | number | boolean | undefined>;
/** A string, a list of paragraphs, or a function of the values (for plurals and other logic). Which
    fields a function reads depends on its key, so its parameter is not narrowed further. */
export type LocaleString = string | readonly string[] | ((values: any) => string);
export type Dictionary = Record<string, string>;
export interface LocaleContent {
  meanings?: Dictionary;
  sentences?: Dictionary;
  hooks?: Dictionary;
  examples?: Dictionary;
  extraMeanings?: Dictionary;
  dailyMeanings?: Dictionary;
  dailySentences?: Dictionary;
  phraseMeanings?: Dictionary;
  wordTitles?: Dictionary;
  phraseTitles?: Dictionary;
  plan?: LocalePlanDay[];
  slow?: LocalePlanDay[];
  review?: Partial<ReviewDay>;
  /** Generated explanation; return `undefined` to use English. */
  explain?: (kana: Kana) => string | undefined;
}
export type ContentSection =
  | 'meanings'
  | 'extraMeanings'
  | 'dailyMeanings'
  | 'phraseMeanings';
/** Every interface string of the source locale (English); code may only ask for these keys. */
type SourceStrings = typeof import('../js/i18n/en.js').default.strings;
export type StringKey = keyof SourceStrings;
/** Keys whose value is a list of paragraphs rather than one string. */
export type ListKey = { [K in StringKey]: SourceStrings[K] extends readonly string[] ? K : never }[StringKey];
export type TextKey = Exclude<StringKey, ListKey>;
/** The strings of a translation: a locale may leave any key out and fall back to English. */
export type PartialStrings = Partial<Record<StringKey, LocaleString>>;
export type TextDirection = 'ltr' | 'rtl';
/** What a locale module exports. */
export interface LocaleDefinition {
  id: LocaleId;
  label: string;
  direction?: TextDirection;
  dateLocale?: string;
  listSeparator?: string;
  strings: Partial<Record<string, LocaleString>>;
  content?: LocaleContent;
}
/** A registered locale with defaults filled in. */
export interface Locale extends LocaleDefinition {
  direction: TextDirection;
  dateLocale: string;
  listSeparator: string;
  content: LocaleContent;
}

/* ---------- students and progress ---------- */
export type AgeGroup = 'child' | 'teen' | 'adult';
export type JapaneseLevel = 'new' | 'some' | 'all';
export type Reason = 'jlpt' | 'travel' | 'work' | 'school' | 'fun' | 'all';
export type Pace = 7 | 14 | 21;
export type DailyMinutes = 10 | 20 | 30;
export type ThemeMode = 'system' | 'light' | 'dark';
export type Tint = 'slate' | 'sand' | 'sky' | 'rose' | 'lilac' | 'sage' | 'white';

export interface Theme {
  mode: ThemeMode;
  tint: Tint;
}
export interface Goal {
  pace: Pace;
  min: DailyMinutes;
  reason: Reason;
}
export interface Avatar {
  t: 'initial' | 'kana' | 'photo';
  k: Kana;
  /** A data URL, kept only in the browser. */
  img: string;
}
export interface Student {
  id: string;
  name: string;
  color: string;
  created: ISODate;
  last: number;
  lang: LocaleId | null;
  age: AgeGroup;
  /** A locale id, `ja`, `other`, or empty. */
  native: string;
  jlevel: JapaneseLevel;
  rate: 0.75 | 1;
  theme: Theme;
  goal: Goal;
  av: Avatar;
}
/** What `cleanStudent` accepts: saved or imported data, so everything but the identity is unchecked. */
export type RawStudent = { id: string; name: string } & Partial<
  Record<Exclude<keyof Student, 'id' | 'name'>, unknown>
>;
/** Fields to change on a saved student; validated like any other input. */
export type StudentPatch = { name?: string } & Partial<
  Record<Exclude<keyof Student, 'id' | 'name'>, unknown>
>;
export interface StudentList {
  v: 1;
  list: Student[];
  current: string | null;
  lang: LocaleId | null;
}

/** Mastery step b (0-5), correct c, wrong w, average milliseconds t. */
export interface LetterStats {
  b: number;
  c: number;
  w: number;
  t: number;
}
/** Completed writes n, clean writes p. */
export interface WriteStats {
  n: number;
  p: number;
}
/** Per-day lesson progress: met letters, written letters, best quiz percent (-1 = none), reading visited, heard daily words, daily words marked done. */
export interface LessonProgress {
  m: Kana[];
  w: Kana[];
  q: number;
  r: boolean;
  d: string[];
  dd: boolean;
  /** Writing checkpoints, scoped to this student and lesson day. */
  writing?: Partial<Record<Kana, { index: number; completed: number }>>;
  writingResume?: Kana;
}
export interface Round {
  d: ISODate;
  n: number;
  p: number;
}
/** The v1 saved format; keys and shapes stay compatible with existing exports. */
export interface Progress {
  v: 1;
  start: ISODate;
  /** Day number -> date it was completed. */
  done: Partial<Record<string, ISODate>>;
  stats: Partial<Record<Kana, LetterStats>>;
  ws: Partial<Record<Kana, WriteStats>>;
  act: Partial<Record<ISODate, number>>;
  rounds: Round[];
  heard: Partial<Record<Kana, number>>;
  /** Letters marked complete -> date. */
  cl: Partial<Record<Kana, ISODate>>;
  /** Seconds studied per day. */
  time: Partial<Record<ISODate, number>>;
  /** "kana>mistaken-for" -> count */
  mix: Partial<Record<string, number>>;
  badges: Partial<Record<string, ISODate>>;
  les: Partial<Record<string, LessonProgress>>;
  updated: number;
  /** When progress was last reset (milliseconds), or 0. A reset beats anything saved before it on any device. */
  reset: number;
}
export type LetterLevel = 'new' | 'learning' | 'solid';

/* ---------- lesson ---------- */
export type LessonStepId = 'meet' | 'write' | 'words' | 'read' | 'quiz';
export interface LessonStep {
  id: LessonStepId;
  n: number;
  m: number;
  score?: number;
  done: boolean;
}

/* ---------- drills ---------- */
export type DrillMode = 'read' | 'choose' | 'listen';

/* ---------- strokes ---------- */
export type Point = [x: number, y: number];
export type StrokePath = Point[];
export interface StrokeTemplates {
  pts: StrokePath[];
  lens: number[];
  cents: Point[];
  /** Signed area of a closed stroke (the ゜ circle); 0 for an open stroke. */
  turn: number[];
}
export interface StrokeFit {
  avg: number;
  avgA: number;
  frA: number;
  pos: number;
  start: number;
  pass?: boolean;
}
export type LoopDirection = 'clockwise' | 'anticlockwise';
export type StrokeVerdict =
  | { kind: 'tiny' | 'short' | 'long' | 'start' | 'shape' }
  | { kind: 'order' | 'again'; j: number }
  | { kind: 'reverse'; loop?: LoopDirection }
  | { kind: 'ok'; fit: StrokeFit };
export interface StrokeSvgOptions {
  guide?: boolean;
  nums?: boolean;
  inkHidden?: boolean;
}
/** The stroke-order drawing: an SVG with playback controls attached. */
export interface StrokeSvg extends SVGSVGElement {
  play(): Promise<void>;
  showInk(on: boolean): void;
  showUpTo(n: number): void;
  clearHint(): void;
  hint(i: number): Promise<void>;
}

/* ---------- drill session ---------- */
export interface DrillQuestion {
  k: Kana;
  /** A missed letter asked again a few questions later. */
  retry: boolean;
}
export interface DrillResult {
  k: Kana;
  ok: boolean;
  ms: number;
}
export interface DrillSession {
  pool: Kana[];
  /** `sel` for the selected set, `miss` for a round of missed letters. */
  src: 'sel' | 'miss';
  mode: DrillMode;
  seq: DrillQuestion[];
  i: number;
  results: DrillResult[];
  misses: Kana[];
  built: boolean;
  locked: boolean;
  t0: number;
  done?: boolean;
  logged?: boolean;
}

/* ---------- writing ---------- */
export interface LessonWritingSequence {
  studentId: string;
  day: number;
  k: Kana;
  index: number;
  passed: boolean;
  /** Number of sequential steps passed; earlier steps remain available for review. */
  completed: number;
}
export interface WriteAttempt {
  k: Kana;
  tpl: StrokeTemplates | null;
  /** Index of the stroke being drawn. */
  i: number;
  miss: number;
  /** Misses on the current stroke. */
  sm: number;
  done: boolean;
  recorded: boolean;
}
export type WriteOutcome = 'ok' | 'bad' | 'ignore';
export interface PadHandler {
  begin(): void;
  end(points: StrokePath): WriteOutcome;
}
export interface WritePad {
  clear(): void;
  undo(): void;
  redraw(): void;
}

/* ---------- shared view state ---------- */
export type ChartView = 'basic' | 'dak' | 'yoon';
export interface UiState {
  lastLevel: number;
  currentTab: TabName;
  navStack: TabName[];
  sheetPushed: boolean;
  rootView: boolean;
  phFilter: string | null;
  phScope: 'goal' | 'all';
  phLetter: string | null;
  rdFilter: string | null;
  rdLetter: string | null;
  resetArmed: boolean;
  lessonQuiz: boolean;
  lessonWrite: boolean;
  lessonWritingSequence: LessonWritingSequence | null;
  meetI: number;
  chartView: ChartView;
  pgTab: 'letters' | 'activity' | 'awards';
  lastFocus: Element | null;
  drillSel: Set<string>;
  drillMode: DrillMode;
  drillLen: number | 'all';
  session: DrillSession | null;
  writeGroup: string;
  writeK: Kana;
  writeGuide: boolean;
  writeNums: boolean;
  writeCheck: boolean;
  pad: WritePad | null;
  writeSvg: StrokeSvg | null;
  padObserver: ResizeObserver | null;
  wq: WriteAttempt | null;
  demoShown: boolean;
  showRo: boolean;
  showMean: boolean;
  /** The first-screen language step is showing (before a language was chosen, or after Change language). */
  langStep: boolean;
  /** A string key explaining why the login screen is showing, or empty. */
  loginMsg: TextKey | '';
}

/* ---------- achievements ---------- */
export type BadgeId =
  | 'first'
  | 'hear'
  | 'clean'
  | 'comp5'
  | 'row'
  | 'comp46'
  | 'str3'
  | 'str7'
  | 'r90'
  | 'r100'
  | 'solid46'
  | 'dak'
  | 'yoon'
  | 'plan';
/** Totals that badges and levels are worked out from. */
export interface ProgressContext {
  ans: number;
  clean: number;
  writes: number;
  heard: number;
  nCl: number;
  clA46: number;
  rowDone: boolean;
  longest: number;
  r90: boolean;
  r100: boolean;
  sA46: number;
  sDak: number;
  sYoon: number;
  planDone: boolean;
}
export interface Badge {
  id: BadgeId;
  /** The kanji shown on the badge. */
  k: string;
  ok: (c: ProgressContext) => boolean;
}
