import type { LearnKanaKey, LogEvent, Track } from '@nekotype/shared/types';
import { DAY_MS, PLAY_OK_MS, PLAY_WRONG_MS, SESSION_TASKS, TASK_DEFAULT_MS } from '../constants';
import { createFold } from '../fold';
import { ITEMS, trackItems } from '../items';
import { nextTask } from '../planner';
import { seededRng } from '../rng';

/** Hours of the two daily sittings, and their length. */
const SITTING_HOURS = [8, 20] as const;
const SITTING_MS = 300_000;
/** The learner's chance of a correct answer: on reviews, and on everything else. */
const REVIEW_OK = 0.9;
const LEARNING_OK = 0.8;
/** Katakana introduced before the track goes back to hiragana. */
const KATAKANA_STAGE = 80;
/** The log is a test fixture: a run that needs more days than this has a bug. */
const MAX_DAYS = 20_000;

/**
 * The production planner played with a seeded learner (P7 plan, D23): two sittings of five minutes
 * a day at 8:00 and 20:00 in UTC, a task every TASK_DEFAULT_MS, recall in PLAY_OK_MS when correct
 * and PLAY_WRONG_MS when wrong. The selected track is hiragana until the 46 basic hiragana are
 * learned, katakana until KATAKANA_STAGE katakana are introduced, then hiragana. Stopped at
 * `answers` answers; with 40,000 it holds both tracks and a katakana row still to come.
 */
export function syntheticLog(options: {
  readonly answers: number;
  readonly seed: number;
}): readonly LogEvent[] {
  const rng = seededRng(options.seed);
  const fold = createFold({ targetMs: 1500, stats: false });
  const events: LogEvent[] = [];
  const dev = 'synthetic';
  let n = 0;
  let answers = 0;
  let stage: 0 | 1 | 2 = 0;
  const emit = (event: LogEvent): void => {
    events.push(event);
    if (fold.apply(event) !== 'applied') throw new Error('synthetic event did not apply');
  };
  const basicLearned = (): boolean =>
    trackItems('hiragana').every(
      (item) => item.category !== 'basic' || fold.state.items.get(item.key)?.phase === 'learned',
    );
  const katakanaIntroduced = (): number =>
    [...fold.state.items.keys()].filter((key) => ITEMS.get(key)?.track === 'katakana').length;
  const trackNow = (): Track => {
    if (stage === 0 && basicLearned()) stage = 1;
    if (stage === 1 && katakanaIntroduced() >= KATAKANA_STAGE) stage = 2;
    return stage === 1 ? 'katakana' : 'hiragana';
  };

  for (let day = 0; answers < options.answers; day += 1) {
    if (day > MAX_DAYS) throw new Error(`the synthetic log is not done after ${MAX_DAYS} days`);
    for (const hour of SITTING_HOURS) {
      const sittingEnd = day * DAY_MS + hour * 3_600_000 + SITTING_MS;
      let at = day * DAY_MS + hour * 3_600_000;
      while (at < sittingEnd && answers < options.answers) {
        emit({ t: 'start', at, dev, n: (n += 1), tz: 0 });
        let previous: LearnKanaKey | null = null;
        let tasks = 0;
        while (tasks < SESSION_TASKS && answers < options.answers) {
          const task = nextTask(fold.state, { now: at, track: trackNow(), previous, rng });
          if (task === null) break;
          if (task.kind === 'introduction') {
            emit({ t: 'intro', at, dev, n: (n += 1), k: task.key });
          } else {
            const review = task.kind === 'recall' && task.review;
            const ok = rng.next() < (review ? REVIEW_OK : LEARNING_OK);
            emit({
              t: 'answer',
              at,
              dev,
              n: (n += 1),
              task: task.kind,
              k: task.key,
              ok,
              ms: ok ? PLAY_OK_MS : PLAY_WRONG_MS,
              hint: false,
              wrong: null,
              alt: null,
            });
            answers += 1;
          }
          previous = task.key;
          tasks += 1;
          at += TASK_DEFAULT_MS;
        }
        emit({ t: 'end', at, dev, n: (n += 1) });
        if (tasks === 0) break;
      }
    }
  }
  return events;
}
