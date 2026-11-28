import type {
  AnswerEvent,
  IntroductionEvent,
  SessionEndEvent,
  SessionStartEvent,
} from '@nekotype/shared/types';

/** Event builders for tests: the defaults of a correct recall by device `d1`; override what matters. */
const BASE = { at: 0, dev: 'd1', n: 1 } as const;

export function intro(
  k: IntroductionEvent['k'],
  over: Partial<Omit<IntroductionEvent, 't' | 'k'>> = {},
): IntroductionEvent {
  return { ...BASE, ...over, t: 'intro', k };
}

export function answer(
  k: AnswerEvent['k'],
  over: Partial<Omit<AnswerEvent, 't' | 'k'>> = {},
): AnswerEvent {
  return {
    ...BASE,
    task: 'recall',
    ok: true,
    ms: 1000,
    hint: false,
    wrong: null,
    alt: null,
    misses: 0,
    w: null,
    ...over,
    t: 'answer',
    k,
  };
}

export function start(
  tz = 0,
  over: Partial<Omit<SessionStartEvent, 't' | 'tz'>> = {},
): SessionStartEvent {
  return { ...BASE, ...over, t: 'start', tz };
}

export function end(over: Partial<Omit<SessionEndEvent, 't'>> = {}): SessionEndEvent {
  return { ...BASE, ...over, t: 'end' };
}
