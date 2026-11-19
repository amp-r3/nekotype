import type * as React from 'react';

/* ================= Notices ================= */
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

export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title: React.ReactNode;
  children?: React.ReactNode;
  /** Buttons, safe action first — it receives initial focus. */
  actions?: React.ReactNode[];
  /** The reserved line of a dialog with a request (a `Notice` with `reserve`): in the actions row, left of the buttons; its own row below 640px (decision 127). */
  note?: React.ReactNode;
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
  /** lg = control-h with space-6 padding (continue, review). */
  size?: 'sm' | 'md' | 'lg';
  /** The system's only icon (linear, 24 grid, stroke 2), always next to a label. */
  icon?: 'reset';
  /** Key hint after the label: 'enter'. */
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
  className?: string;
}
export declare function Segmented(props: SegmentedProps): React.ReactElement;

export interface SwitchProps { label: React.ReactNode; description?: React.ReactNode; checked?: boolean; defaultChecked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean; className?: string }
export declare function Switch(props: SwitchProps): React.ReactElement;

export interface FieldProps { label?: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode }
export interface InputProps extends FieldProps, React.InputHTMLAttributes<HTMLInputElement> { mono?: boolean }
export declare function Input(props: InputProps): React.ReactElement;
export interface SelectProps extends FieldProps, React.SelectHTMLAttributes<HTMLSelectElement> { options: { value: string; label: React.ReactNode; disabled?: boolean }[] }
export declare function Select(props: SelectProps): React.ReactElement;

export interface TooltipProps { label: React.ReactNode; side?: 'top' | 'bottom'; open?: boolean; children: React.ReactElement }
export declare function Tooltip(props: TooltipProps): React.ReactElement;

/* ================= Stats ================= */
export interface StatProps { label: React.ReactNode; value: React.ReactNode; unit?: string; note?: React.ReactNode; className?: string }
export declare function Stat(props: StatProps): React.ReactElement;

/** One day (or one week) on the chart: lo–hi is the bar, mid the tick. */
export interface ChartRange { x: number; lo: number; hi: number; mid: number; tip: string[] }
/** The answer-time chart of /stats (decisions 109, 130). The page computes the series; the chart only draws. */
export interface ResultChartProps {
  /** One bar per day or per week. */
  ranges: ChartRange[];
  /** Number of bar slots on the x axis (days or weeks in the domain): sets the bar width. */
  slots?: number;
  xDomain: [number, number];
  /** false = no x labels (a chart stacked over another one). */
  xTicks?: { x: number; label: string }[] | false;
  /** The y axis follows the data in steps of 250 or 500 ms and always holds the target (decision 109). */
  yDomain: [number, number];
  yTicks?: number[];
  yFormat?: (v: number) => string;
  /** One dashed hair line, e.g. the target answer time. */
  reference?: { value: number; label: string };
  height?: number;
  axisWidth?: number;
  /** Index of the bar under the cursor (controlled; previews). */
  cursor?: number;
  label?: string;
  className?: string;
}
export declare function ResultChart(props: ResultChartProps): React.ReactElement;

/** One local day: recall answers of both tracks (the sum of the day's answer-time bins). */
export interface ActivityDay { day: string; answers: number; /** An active day without a recall answer (recognition only): step 1. */ active?: boolean; /** A day of the current streak: a dot in the cell's ink. */ run?: boolean }
export interface ActivityMapLabels { label: string; less: string; more: string; today: string; run: string; months: string[]; /** Monday first. */ weekdays: string[]; tip: (d: ActivityDay, date: string) => string[] }
export interface ActivityMapProps {
  /** Any order, days without an entry are empty. */
  days: ActivityDay[];
  /** ISO date of the last cell. */
  today: string;
  /** The map fills its width (decision 137): as many weeks as fit at `minCell`, at most `maxWeeks` (default 26); the cells grow to the edge, at most `maxCell`. */
  maxWeeks?: number;
  /** Smallest cell, px; default 16 (space-4). */
  minCell?: number;
  /** Largest cell, px; default 28. */
  maxCell?: number;
  /** Lower bounds of the five steps; default [1, 10, 25, 50, 100]. */
  thresholds?: number[];
  labels?: Partial<ActivityMapLabels>;
  className?: string;
}
export declare function ActivityMap(props: ActivityMapProps): React.ReactElement;

/** A kana's datum (ADR 058). A kana without a datum is locked. */
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
/** The learning table on `/` (ADR 058; one mode since decision 128). */
export interface KanaChartProps {
  script?: 'hiragana' | 'katakana';
  /** Keyed by kana. */
  data: Record<string, KanaState>;
  /** Canonical romaji of a kana (engine table, first `ime` spelling). */
  romaji?: (kana: string) => string;
  onSelect?: (kana: string) => void;
  /** The locked kana that opens next — its tooltip adds `opens next`. */
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
/** Tooltip and aria-label lines of a kana. */
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

export declare function Icon(props: { name: 'reset'; className?: string }): React.ReactElement;

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

/* ================= Shell ================= */
export interface NavItem { id: string; label: React.ReactNode; href?: string }
export interface NavProps {
  items: NavItem[];
  active?: string | null;
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

export interface FooterProps { links: { id: string; label: React.ReactNode; href?: string; onClick?: () => void }[] }
export declare function Footer(props: FooterProps): React.ReactElement;

/** `content` and `grumpy` are drawn and have no place in the product yet (decisions 98, 136). */
export type CatMood = 'neutral' | 'sleep' | 'content' | 'grumpy';
export interface CatProps {
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
      Notice: typeof Notice; Kbd: typeof Kbd; Dialog: typeof Dialog; Button: typeof Button; Segmented: typeof Segmented;
      Switch: typeof Switch; Input: typeof Input; Select: typeof Select; Tooltip: typeof Tooltip;
      Stat: typeof Stat; ResultChart: typeof ResultChart; ActivityMap: typeof ActivityMap;
      KanaChart: typeof KanaChart; OptionCard: typeof OptionCard;
      Nav: typeof Nav; Footer: typeof Footer; Cat: typeof Cat; EmptyState: typeof EmptyState;
      useNarrow: typeof useNarrow; kanaRows: typeof kanaRows; kanaOf: typeof kanaOf;
      KanaChartDetails: typeof KanaChartDetails; kanaStateLines: typeof kanaStateLines; isDue: typeof isDue; Icon: typeof Icon; KanaTask: typeof KanaTask; createTaskController: typeof createTaskController; useCoarse: typeof useCoarse;
    };
  }
}
