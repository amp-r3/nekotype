import type * as React from 'react';

/* ================= Test stream =================
 * Reference implementation in React; the product rewrites it in Preact (shared/ui).
 * Contract: the component renders ONCE per prompt. Every keystroke goes through the controller
 * (classList / textContent / transform writes against cached positions) — 0 renders per key.
 */
export type CharState = 'untyped' | 'correct' | 'miss';
export interface TestController {
  /** Mark char i. Colour switches instantly (no transition). */
  mark(i: number, state: CharState): void;
  /** Move the caret to char i; skip chars before it become `is-skip is-done`. */
  moveTo(i: number): void;
  /** Next index ≥ i that needs input (skips spaces and punctuation). */
  nextTypeable(i: number): number;
  /** Pending romaji from engine.view(); positioned under the caret, clamped to the line end. Never shifts text. */
  setBuffer(romaji: string): void;
  /** Rejected key: miss flash on the caret for dur-reject (opacity layer, WAAPI). */
  reject(): void;
  setCounter(value: string | number): void;
  setLive(kpm: string | number, accuracy: string | number): void;
  /** Caret blinks while the user is idle > 1 s. */
  idle(on: boolean): void;
  /** Called automatically on window blur / focus — not on focus moving to Restart or a link. */
  setWindowFocus(focused: boolean): void;
  /** The page's hidden input lost / regained focus while the window kept it: shows the reserved `click to focus` caption. */
  setInputFocus(focused: boolean): void;
  reset(): void;
  isSkip(i: number): boolean;
  readonly length: number;
  /** Re-read positions (called on resize and fonts.ready); the caret snaps into place without a transition. */
  measure(): void;
  destroy(): void;
}
export declare function createTestController(root: HTMLElement, opts?: { lines?: number }): TestController;

export interface TestAreaProps {
  /** Prompts in kana. Each prompt is one unbreakable run; a line breaks only between prompts, with a 0.35em gap (ADR 047). */
  words: string[];
  /** ADR 058: no kana mode — jp-solo belongs to learning tasks. */
  mode?: 'words' | 'phrase';
  /** Initial counter value; later updates go through the controller: seconds left (time), finished prompts (count, zen). */
  counter?: string | number | null;
  /** Static unit after the counter, set once per test: ' s' / ' с' (time), ' / 25' (count); none in zen. */
  counterSuffix?: string;
  /** Live KPM and accuracy next to the counter (default true). */
  live?: boolean;
  /** Visible lines: 3 on desktop, 2 below bp-narrow by default. */
  lines?: number;
  /** i18n strings. */
  labels?: { kpm?: string; acc?: string; blur?: string; repeat?: string; reveal?: string; focus?: string };
  /** Bottom line: the `esc` + `show the romaji` hint and the reserved `click to focus` caption (default true). */
  hints?: boolean;
  /** Touch layout: a `show the romaji` text button instead of the `esc` hint; default `(pointer: coarse)`. */
  coarse?: boolean;
  /** The `show the romaji` button (touch). */
  onShow?: () => void;
  /** Repeat run (ADR 033): static outlined `repeat` / «повтор» mark in fur-dim after KPM and accuracy. Set once per test. */
  repeat?: boolean;
  /** Receives the controller after mount and after every prompt change. */
  onReady?: (ctl: TestController) => void;
  /** Called on every render — for render-count tests. */
  onRender?: () => void;
  className?: string;
}
export declare const TestArea: React.ForwardRefExoticComponent<TestAreaProps & React.RefAttributes<{ current: TestController | null }>>;

export interface CharProps { kana: string; state?: CharState | 'current'; skip?: boolean }
export declare function Char(props: CharProps): React.ReactElement;

export interface TranslationLineProps {
  /** Translation in the UI language; empty keeps the reserved height. */
  text?: React.ReactNode;
  /** The show-translation setting is off (ADR 056): two-line height kept, no translation, no report; `source` stays (attribution). */
  hidden?: boolean;
  /** Tatoeba link — required for phrases (licence), absent for words. Shown whether or not `hidden`. */
  sourceHref?: string | null;
  onReport?: () => void;
  /** Disables `report a problem` with an explanation. */
  offline?: boolean;
  labels?: { source?: string; report?: string; offline?: string };
  className?: string;
}
export declare function TranslationLine(props: TranslationLineProps): React.ReactElement;

export interface NoticeProps {
  children?: React.ReactNode;
  /** Romaji line in mono-romaji. */
  mono?: boolean;
  /** Revealed romaji: `lead` in fur-dim, the romaji in eye. */
  reveal?: boolean;
  lead?: React.ReactNode;
  /** Loading: static text, no animation; sets aria-busy. */
  loading?: boolean;
  tone?: 'default' | 'miss';
  /** Keep the slot's height when empty so the text never jumps. */
  reserve?: boolean;
  /** Trailing action: a `sign in again` link or a secondary `retry` button. */
  action?: React.ReactNode;
  role?: 'status' | 'alert';
  className?: string;
}
export declare function Notice(props: NoticeProps): React.ReactElement;

export interface KbdProps { children: React.ReactNode; /** No keycap border — inside buttons. */ bare?: boolean; className?: string }
export declare function Kbd(props: KbdProps): React.ReactElement;

/* ================= Modes ================= */
export interface ModeValue {
  script: 'hiragana' | 'katakana' | 'both';
  content: 'words' | 'phrases';
  /** Engine `Strictness`: 'learner' = relaxed, 'ime' = strict IME. */
  strict: 'learner' | 'ime';
  type: 'time' | 'count' | 'zen';
  /** Seconds (15/30/60/120) or items (10/25/50/100); ignored for zen. */
  amount: number;
  weakFocus: boolean;
}
export interface ModePanelProps {
  value: Partial<ModeValue>;
  onChange?: (value: ModeValue) => void;
  /** During a typing test: fades out, then visibility: hidden + inert, space kept (ADR 041, 055). */
  hidden?: boolean;
  /** Collapsed to the mode line with a tap to open; default below 640px. */
  compact?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  lang?: 'ru' | 'en';
  labels?: Record<string, string>;
  className?: string;
}
/** The mode line from i18n: `words · hiragana · relaxed · 60 s` (+ ` · weak kana`). Used above KPM and as the collapsed ModePanel. */
export declare function modeLine(value: Partial<ModeValue>, lang?: 'ru' | 'en', labels?: Record<string, string>): string;
export declare function ModePanel(props: ModePanelProps): React.ReactElement;

export interface RowPickerProps {
  script?: 'hiragana' | 'katakana' | 'both';
  /** Engine `RowId`s: vowels k s t n h m y r w_n · g z d b p · ky sh ch ny hy my ry gy j by py · ext_fa ext_va ext_wi ext_ti ext_che (katakana and 'both' only). */
  value: string[];
  onChange?: (rows: string[]) => void;
  labels?: { base?: string; voiced?: string; combo?: string; all?: string; none?: string; count?: (n: number) => string; empty?: string };
}
export declare function RowPicker(props: RowPickerProps): React.ReactElement;

export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title: React.ReactNode;
  children?: React.ReactNode;
  /** Buttons, safe action first — it receives initial focus. */
  actions?: React.ReactNode[];
  /** Render in place without a modal backdrop (docs only). */
  inline?: boolean;
  /** aria-label of the ✕ close button (shown when onClose is set). */
  closeLabel?: string;
  className?: string;
}
export declare function Dialog(props: DialogProps): React.ReactElement;

/* ================= Controls ================= */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** In code: 'ghost' = 'text'. */
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  /** lg = control-h with space-6 padding (next test, continue, review). */
  size?: 'sm' | 'md' | 'lg';
  /** The system's only icons (linear, 24 grid, stroke 2), always next to a label. */
  icon?: 'restart' | 'reset';
  /** Key hint after the label: 'enter', 'ctrl + enter'. */
  hint?: string;
}
export declare function Button(props: ButtonProps): React.ReactElement;

export interface SegmentedOption { value: string | number; label: React.ReactNode; disabled?: boolean }
export interface SegmentedProps {
  options: SegmentedOption[];
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (value: string | number) => void;
  label: string;
  mono?: boolean;
  /** 'lg' — `ui-heading` items: the sections of a page (`/stats`: learning · typing). */
  size?: 'lg';
  className?: string;
}
export declare function Segmented(props: SegmentedProps): React.ReactElement;
/** One on/off item in segment style (`aria-pressed`): `weak kana` in the config bar, `with repeats` on /stats. */
export declare function Toggle(props: { pressed?: boolean; onChange?: (pressed: boolean) => void; children?: React.ReactNode }): React.ReactElement;

export interface SwitchProps { label: React.ReactNode; description?: React.ReactNode; checked?: boolean; defaultChecked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean; className?: string }
export declare function Switch(props: SwitchProps): React.ReactElement;

export interface FieldProps { label?: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode }
export interface InputProps extends FieldProps, React.InputHTMLAttributes<HTMLInputElement> { mono?: boolean }
export declare function Input(props: InputProps): React.ReactElement;
export interface TextareaProps extends FieldProps, React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
export declare function Textarea(props: TextareaProps): React.ReactElement;
export interface SelectProps extends FieldProps, React.SelectHTMLAttributes<HTMLSelectElement> { options: { value: string; label: React.ReactNode; disabled?: boolean }[] }
export declare function Select(props: SelectProps): React.ReactElement;

export interface TooltipProps { label: React.ReactNode; side?: 'top' | 'bottom'; open?: boolean; children: React.ReactElement }
export declare function Tooltip(props: TooltipProps): React.ReactElement;

/* ================= Results & stats ================= */
export interface StatComparison {
  /** Signed difference; rendered with + or U+2212, always fur. */
  delta: number;
  /** `vs average (84)` / `к среднему (84)`, `vs personal best (101)`, `vs previous best (101)`. */
  label: React.ReactNode;
}
export interface StatProps { label: React.ReactNode; value: React.ReactNode; unit?: string; note?: React.ReactNode; size?: 'hero' | 'md'; /** e.g. <PersonalBestBadge/> next to the label */ badge?: React.ReactNode;
  /** Lines under the hero number on typing results; no colour judgement. */
  comparisons?: StatComparison[]; className?: string }
export declare function Stat(props: StatProps): React.ReactElement;

export interface PersonalBestBadgeProps { children?: React.ReactNode }
export declare function PersonalBestBadge(props: PersonalBestBadgeProps): React.ReactElement;

/** One test on the chart. `x` is time (ms) — or a slot index 0–4 while there are fewer than five tests. */
export interface ChartPoint { x: number; y: number; /** 'best' = personal best (a ring), 'hollow' = a repeat. */ mark?: 'best' | 'hollow' | null; /** Tooltip lines. */ tip: string[] }
/** One day (or one week) on the chart: lo–hi is the bar, mid the tick. */
export interface ChartRange { x: number; lo: number; hi: number; mid: number; tip: string[] }
export interface ResultChartProps {
  /** One mark per test. The page computes every series; the chart only draws. */
  points?: ChartPoint[];
  /** The rolling median (null breaks the line). Not drawn for fewer than five tests or for mixed modes. */
  line?: ({ x: number; y: number } | null)[];
  /** The middle half (25–75%) of the same window, behind the line. */
  band?: ({ x: number; lo: number; hi: number } | null)[];
  /** One bar per day or per week (the answer-time chart). */
  ranges?: ChartRange[];
  /** Number of bar slots on the x axis (days or weeks in the domain): sets the bar width. */
  slots?: number;
  xDomain: [number, number];
  /** false = no x labels (a chart stacked over another one). */
  xTicks?: { x: number; label: string }[] | false;
  /** The y axis follows the data (decision 106); never fixed to 0–120. */
  yDomain: [number, number];
  yTicks?: number[];
  yFormat?: (v: number) => string;
  /** One dashed hair line, e.g. the target answer time. */
  reference?: { value: number; label: string };
  /** Draw each point's number over it: fewer than five tests. */
  pointLabels?: boolean;
  height?: number;
  axisWidth?: number;
  /** Index of the mark under the cursor (controlled; previews). */
  cursor?: number;
  label?: string;
  className?: string;
}
export declare function ResultChart(props: ResultChartProps): React.ReactElement;

/** One local day: recall answers of both tracks (the sum of the day's answer-time bins) and finished typing tests (by endedAt). */
export interface ActivityDay { day: string; answers: number; tests: number; /** An active day without a recall answer (recognition only): step 1. */ active?: boolean }
export interface ActivityMapLabels { label: string; less: string; more: string; test: string; today: string; months: string[]; /** Monday first. */ weekdays: string[]; tip: (d: ActivityDay, date: string) => string[] }
export interface ActivityMapProps {
  /** Any order, days without an entry are empty. */
  days: ActivityDay[];
  /** ISO date of the last cell. */
  today: string;
  /** Columns: 12–26 (the page passes as many as there is history); default 26. */
  weeks?: number;
  /** Columns below 640px; default 13. */
  weeksNarrow?: number;
  /** Lower bounds of the five steps; default [1, 10, 25, 50, 100]. */
  thresholds?: number[];
  labels?: Partial<ActivityMapLabels>;
  className?: string;
}
export declare function ActivityMap(props: ActivityMapProps): React.ReactElement;

/** A mistyped kana on typing results: accepted spellings and the number of errors (no reaction time, ADR 058). */
export interface WeakKana { kana: string; spellings: string[]; misses: number }
export interface WeakKanaListProps { items: WeakKana[]; labels?: { kana?: string; typed?: string; misses?: string } }
export declare function WeakKanaList(props: WeakKanaListProps): React.ReactElement;

/** State-mode datum (ADR 058). A kana without a datum is locked. */
export interface KanaState {
  state: 'learning' | 'confident' | 'mastered';
  /** Leitner box 0–5. Boxes drive the review schedule only, never unlocking. */
  box: number;
  /** The review date has come. A mark over confident or mastered, not a state; ignored on learning. */
  due: boolean;
  /** ISO date of the next review (box ≥ 1). */
  next: string | null;
  /** Median answer time of the last 10 recall answers, ms. */
  median: number;
  /** Accuracy of the last 10 recall answers, %. */
  acc: number;
  /** Recall answers counted (≤ 10); 0 = not introduced yet. */
  answers: number;
  /** Kana chosen instead of this one in recognition: [kana, count]. */
  mixups: [string, number][];
  /** Recognition: [correct, total]. */
  recog: [number, number];
}
export type KanaChartDatum = KanaState | { v: number; n?: number } | number | 'new' | 'locked';
export interface KanaChartProps {
  /** state (MVP): learning table on `/`. miss / time (heatmaps) and box (v9) are not used in the MVP. */
  mode: 'state' | 'miss' | 'time' | 'box';
  script?: 'hiragana' | 'katakana';
  /** Keyed by kana. */
  data: Record<string, KanaChartDatum>;
  /** Canonical romaji of a kana (engine table, first `ime` spelling). */
  romaji?: (kana: string) => string;
  onSelect?: (kana: string) => void;
  /** state mode: the locked kana that opens next — its tooltip adds `opens next`. */
  nextUnlock?: string | null;
  label: string;
  /** Tooltip language (lang attribute). */
  lang?: string;
  labels?: Record<string, string | ((...a: any[]) => string)>;
  className?: string;
}
export declare function KanaChart(props: KanaChartProps): React.ReactElement;
/** The activation details: mixups and recognition accuracy. */
export declare function KanaChartDetails(props: { kana: string; data?: KanaState; romaji?: (k: string) => string; labels?: Record<string, any>; onClose?: () => void }): React.ReactElement;
/** Tooltip and aria-label lines of a kana in the state mode. */
export declare function kanaStateLines(kana: string, data: KanaState | undefined, labels: Record<string, any>, romaji?: (k: string) => string, nextUnlock?: string | null): string[];
/** True when the review-due mark applies: `due` on a confident or mastered kana. */
export declare function isDue(data: KanaState | undefined): boolean;
/* ---------- KanaTask (ADR 058): one task of a learning or review session ---------- */
export interface TaskController {
  /** recall: pending romaji under the kana. */
  setBuffer(s: string): void;
  /** introduction: n letters of the ghost hint typed. */
  type(n: number): void;
  /** Rejected key: 120ms miss flash of the caret. */
  reject(): void;
  /** The answer is complete. The session holds it 400ms (recall, correct recognition); keys during the hold are ignored. */
  finish(result: 'correct' | 'miss'): void;
  /** The task starts over (the tab was hidden): input cleared; recorded errors stay. */
  reset(): void;
  setWindowFocus(on: boolean): void;
  setInputFocus(on: boolean): void;
  measure(): void;
  readonly kind: 'introduction' | 'recall' | 'recognition';
  destroy(): void;
}
export interface KanaTaskProps {
  kind: 'introduction' | 'recall' | 'recognition';
  /** introduction, recall. */
  kana?: string;
  /** introduction: the ghost hint; recognition: the prompt. */
  romaji?: string;
  /** The session line: `learning · 7 of 25`. */
  session: { kind: 'learning' | 'review'; n: number; total: number };
  /** Content of the reserved notice line (a Notice). */
  notice?: React.ReactNode;
  /** recognition: four OptionCards. */
  children?: React.ReactNode;
  /** `leave session` (proposal). */
  onLeave?: () => void;
  /** recall under pointer: coarse: the `show the romaji` button (no Esc on an on-screen keyboard). */
  onShow?: () => void;
  /** Force the touch layout; by default `(pointer: coarse)`. */
  coarse?: boolean;
  label?: string;
  optionsLabel?: string;
  labels?: Partial<Record<'learning' | 'review' | 'of' | 'newKana' | 'show' | 'blur' | 'focus' | 'leave', string>>;
  onReady?: (ctl: TaskController) => void;
  onRender?: () => void;
  className?: string;
}
export declare const KanaTask: React.ForwardRefExoticComponent<KanaTaskProps & React.RefAttributes<{ current: TaskController | null }>>;
export declare function createTaskController(root: HTMLElement): TaskController;
/** true under (pointer: coarse). */
export declare function useCoarse(): boolean;

export declare function Icon(props: { name: 'restart' | 'reset'; className?: string }): React.ReactElement;

export interface HistoryRow { date: string; mode: string; kpm: number; acc: number; time: string; best?: boolean }
export interface HistoryTableProps { rows: HistoryRow[]; loading?: boolean; bestLabel?: string; labels?: Record<string, string> }
export declare function HistoryTable(props: HistoryTableProps): React.ReactElement;

export interface PaginationProps { page: number; pages: number; onPage?: (page: number) => void; labels?: { prev?: string; next?: string; label?: string } }
export declare function Pagination(props: PaginationProps): React.ReactElement;

/* ================= Learning ================= */
export interface OptionCardProps {
  /** 1–4: the key that picks it. */
  n: number;
  children: React.ReactNode;
  /** Content is kana (jp-test-sm) rather than romaji (mono-stat). */
  kana?: boolean;
  state?: 'idle' | 'correct' | 'wrong' | 'reveal';
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}
export declare function OptionCard(props: OptionCardProps): React.ReactElement;

export interface VerticalLabelProps { children: React.ReactNode; ariaLabel: string; className?: string }
export declare function VerticalLabel(props: VerticalLabelProps): React.ReactElement;

/* ================= Shell ================= */
export interface NavItem { id: string; label: React.ReactNode; href?: string }
export interface NavProps {
  items: NavItem[];
  active?: string | null;
  /** During a typing test: fades out, then visibility: hidden + inert — out of the Tab order, space kept (ADR 041, 055). */
  hidden?: boolean;
  lang?: 'en' | 'ru';
  onLang?: (lang: 'en' | 'ru') => void;
  /** Sign-in link label (leads to /settings); null hides it (signed in, preview environments). */
  loginLabel?: string | null;
  onNavigate?: (id: string) => void;
  label?: string;
  langLabel?: string;
  homeHref?: string;
  homeLabel?: string;
  className?: string;
}
export declare function Nav(props: NavProps): React.ReactElement;

export interface FooterProps { links: { id: string; label: React.ReactNode; href?: string; onClick?: () => void }[]; hidden?: boolean }
export declare function Footer(props: FooterProps): React.ReactElement;

/** `grumpy` is drawn in `geometry` only and has no place in the product yet (decision 98). */
export type CatMood = 'neutral' | 'sleep' | 'content' | 'grumpy';
export interface CatProps {
  /** Product style is 'geometry'. 'line' and 'silhouette' are archived. */
  variant?: 'geometry' | 'line' | 'silhouette';
  mood?: CatMood;
  mark?: boolean;
  size?: number;
  label?: string;
  className?: string;
}
export declare function Cat(props: CatProps): React.ReactElement;

export interface EmptyStateProps { title: React.ReactNode; text?: React.ReactNode; action?: React.ReactNode; mood?: 'sleep' | 'neutral'; size?: number; className?: string }
export declare function EmptyState(props: EmptyStateProps): React.ReactElement;

export declare function useNarrow(): boolean;

export interface KanaRow { group: 'base' | 'voiced' | 'combo' | 'ext'; id: string; head: string; hira: (string | null)[] | null; kata: (string | null)[] }
/** Rows of a track in table order: hiragana 26, katakana 31 (`'both'` = 31). */
export declare function kanaRows(script: 'hiragana' | 'katakana' | 'both'): KanaRow[];
/** Every kana of a track: hiragana 104, katakana 125. */
export declare function kanaOf(script: 'hiragana' | 'katakana'): string[];

declare global {
  interface Window {
    Nekotype: {
      TestArea: typeof TestArea; Char: typeof Char; TranslationLine: typeof TranslationLine; Notice: typeof Notice; Kbd: typeof Kbd;
      ModePanel: typeof ModePanel; RowPicker: typeof RowPicker; Dialog: typeof Dialog; Button: typeof Button; Segmented: typeof Segmented;
      Switch: typeof Switch; Input: typeof Input; Textarea: typeof Textarea; Select: typeof Select; Tooltip: typeof Tooltip;
      Stat: typeof Stat; PersonalBestBadge: typeof PersonalBestBadge; ResultChart: typeof ResultChart; ActivityMap: typeof ActivityMap; Toggle: typeof Toggle; WeakKanaList: typeof WeakKanaList;
      KanaChart: typeof KanaChart; HistoryTable: typeof HistoryTable; Pagination: typeof Pagination; OptionCard: typeof OptionCard;
      VerticalLabel: typeof VerticalLabel; Nav: typeof Nav; Footer: typeof Footer; Cat: typeof Cat; EmptyState: typeof EmptyState;
      createTestController: typeof createTestController; useNarrow: typeof useNarrow; kanaRows: typeof kanaRows; modeLine: typeof modeLine; kanaOf: typeof kanaOf;
      KanaChartDetails: typeof KanaChartDetails; kanaStateLines: typeof kanaStateLines; isDue: typeof isDue; Icon: typeof Icon; KanaTask: typeof KanaTask; createTaskController: typeof createTaskController; useCoarse: typeof useCoarse;
    };
  }
}
