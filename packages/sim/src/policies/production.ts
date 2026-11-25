import { createFold, forecastRow, habitsOf, ITEMS, nextTask, SESSION_TASKS } from '@nekotype/model';
import type { Fold, ModelState } from '@nekotype/model';
import type { LearnKanaKey, LogEvent, Track } from '@nekotype/shared/types';
import type { Item } from '../items';
import { recognitionOptions } from '../options';
import { createRng } from '../rng';
import type { Answer, Policy, Session, Task } from '../policy';
import type { PolicyFactory } from '../run';

/** The target answer time of the fold's grades, as the app's default (ms). */
const TARGET_MS = 1500;
/** The longest answer time an event holds. */
const MS_CAP = 10_000;

/**
 * The production knowledge model as a policy (P7 plan, D10): a `Fold` of the log and `nextTask`
 * of `@nekotype/model`. It converts the simulator's tasks and answers to keys and events and
 * writes no rule of the fold or the planner (rule 3a). Sim items map to keys by position: the
 * simulator's items are in `ITEMS` order, hiragana first. `track`: the selected track, or a
 * function of the state that picks it (the learner who follows the katakana suggestion).
 */
export function createProductionPolicy(
  selected: Track | ((state: ModelState) => Track) = 'hiragana',
): PolicyFactory {
  const trackOf = (state: ModelState): Track =>
    typeof selected === 'string' ? selected : selected(state);
  return (items, rng) => {
    const keys = keysOf(items);
    const ids = new Map(keys.map((key, id) => [key, id]));
    const idOf = (key: LearnKanaKey): number => {
      const id = ids.get(key);
      if (id === undefined) throw new Error(`no item for ${key}`);
      return id;
    };
    const keyOfId = (id: number): LearnKanaKey => {
      const key = keys[id];
      if (key === undefined) throw new Error(`no key for item ${id}`);
      return key;
    };
    // The forecast draws from a stream of its own: asking for one never changes the run.
    const forecastRng = createRng(0x2545f491);
    const fold: Fold = createFold({ targetMs: TARGET_MS, stats: false });
    let n = 0;
    const emit = (event: LogEvent): void => {
      if (fold.apply(event) !== 'applied') {
        throw new Error(`event ${event.t} at ${event.at} did not apply`);
      }
    };
    const introduced = (id: number): boolean => fold.state.items.has(keyOfId(id));

    const policy: Policy = {
      name: 'production model',
      session(): Session {
        let count = 0;
        let previous: LearnKanaKey | null = null;
        let started = false;
        let ended = false;
        const finish = (now: number): void => {
          if (started && !ended) emit({ t: 'end', at: now, dev: 'sim', n: (n += 1) });
          ended = true;
        };
        return {
          kind: 'learning',
          next(now) {
            if (ended) return undefined;
            if (!started) {
              emit({ t: 'start', at: now, dev: 'sim', n: (n += 1), tz: 0 });
              started = true;
            }
            if (count >= SESSION_TASKS) {
              finish(now);
              return undefined;
            }
            const planned = nextTask(fold.state, {
              now,
              track: trackOf(fold.state),
              previous,
              rng,
            });
            if (planned === null) {
              finish(now);
              return undefined;
            }
            count += 1;
            previous = planned.key;
            const id = idOf(planned.key);
            const task: Task = {
              item: id,
              kind: planned.kind,
              options:
                planned.kind === 'recognition'
                  ? recognitionOptions(items, id, introduced, rng)
                  : [],
              review: planned.kind === 'recall' && planned.review,
            };
            return task;
          },
          record(answer: Answer) {
            const key = keyOfId(answer.task.item);
            const base = { at: answer.at, dev: 'sim', n: (n += 1) };
            if (answer.task.kind === 'introduction') {
              emit({ ...base, t: 'intro', k: key });
              return;
            }
            emit({
              ...base,
              t: 'answer',
              task: answer.task.kind,
              k: key,
              ok: answer.ok,
              ms: Math.min(MS_CAP, Math.max(0, Math.round(answer.ms))),
              hint: false,
              wrong: answer.wrong === undefined ? null : keyOfId(answer.wrong),
              alt: null,
            });
          },
        };
      },
      unlocked: () => fold.state.items.size,
      forecast(ids, now, history) {
        const first = ids[0];
        const row = first === undefined ? undefined : ITEMS.get(keyOfId(first))?.row;
        if (row === undefined) return undefined;
        const { raw, low, median, high } = forecastRow(fold.state, row, {
          now,
          track: trackOf(fold.state),
          rng: forecastRng,
          habits: habitsOf(fold.state),
          history,
        });
        return { raw, low, median, high };
      },
    };
    return policy;
  };
}

/** The key of each sim item, by position; throws when the simulator's items are not the model's. */
function keysOf(items: readonly Item[]): readonly LearnKanaKey[] {
  const all = [...ITEMS.values()];
  return items.map((item) => {
    const entry = all[item.id];
    if (entry === undefined || entry.kana !== item.kana || entry.track !== item.track) {
      throw new Error(`item ${item.id} (${item.kana}) is not the model's`);
    }
    return entry.key;
  });
}
