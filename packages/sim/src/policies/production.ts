import { createFold, forecastRow, habitsOf, ITEMS, nextTask, SESSION_TASKS } from '@nekotype/model';
import type { Fold, ModelState } from '@nekotype/model';
import type { AnswerEvent, LearnKanaKey, LogEvent, Track } from '@nekotype/shared/types';
import type { Item } from '../items';
import { recognitionOptions } from '../options';
import { createRng } from '../rng';
import type { Answer, Policy, Session, Task } from '../policy';
import type { PolicyFactory } from '../run';

/** The longest answer time an event holds. */
const MS_CAP = 10_000;

/**
 * How the model hears of a word task (P9 research, part 2):
 * - `none`: not at all (the learner reads, the log has nothing);
 * - `credit`: a `word` answer, which the fold grades by ADR 100's table (each learned kana a hard
 *   review on success, nothing on an error);
 * - `again`: `credit`, and the first kana read wrong as a failed recall;
 * - `recalls`: each kana of the word as a recall of its own, right or wrong, with its own time.
 */
export type WordMode = 'none' | 'credit' | 'again' | 'recalls';

export interface WordOptions {
  /** The words the planner may give: the sim item ids of each word's kana, in reading order. */
  readonly words: readonly (readonly number[])[];
  /** A word task after every this many kana tasks of a session (part 2); none without it. */
  readonly every?: number | undefined;
  readonly mode: WordMode;
  /** Words of learned kana only (the default), or of every introduced kana, learning ones too. */
  readonly of?: 'learned' | 'introduced';
  /**
   * Part 3: the share of the planner's recalls given as a word that holds the kana asked, when
   * one is readable (the word carries the recall); none without it.
   */
  readonly carrier?: number | undefined;
  /** Part 3: no word before this many words are readable at the start of a session. */
  readonly minPool?: number | undefined;
  /** Part 3: a word among the last this many words given is not given again. */
  readonly recent?: number | undefined;
  /** Part 3: the last task of a session is a word whose kana were all in the session. */
  readonly closing?: boolean | undefined;
}

export interface ProductionOptions {
  readonly line?: ((answer: AnswerEvent) => number) | undefined;
  readonly deviceOf?: ((at: number) => string) | undefined;
  /** Word tasks between the kana tasks (P9 research, part 2); none without it. */
  readonly words?: WordOptions | undefined;
  /**
   * Part 3: after a wrong answer, the kana comes back as a recall this many tasks later in the
   * same session, beside the model's own learning step; none without it.
   */
  readonly recheck?: number | undefined;
}

/**
 * The production knowledge model as a policy (P7 plan, D10): a `Fold` of the log and `nextTask`
 * of `@nekotype/model`. It converts the simulator's tasks and answers to keys and events and
 * writes no rule of the fold or the planner (rule 3a). Sim items map to keys by position: the
 * simulator's items are in `ITEMS` order, hiragana first. `track`: the selected track, or a
 * function of the state that picks it (the learner who follows the katakana suggestion).
 * `options.line`: the fold's line for a timed answer instead of the learner's pace (ADR 115), for
 * the research rules of the adaptive answer-time note. `options.deviceOf`: the `dev` of the events
 * at a time ('sim' without it).
 */
export function createProductionPolicy(
  selected: Track | ((state: ModelState) => Track) = 'hiragana',
  options: ProductionOptions = {},
): PolicyFactory {
  const { line } = options;
  const deviceOf = options.deviceOf ?? ((): string => 'sim');
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
    // Words draw from their own stream too, so the planner's choices stay those of a run without.
    const wordRng = createRng(0x51ed270b);
    const words = options.words;
    const pool = words?.words ?? [];
    // The words that hold each kana, for a carried recall.
    const byKana = new Map<number, number[]>();
    pool.forEach((ids, index) => {
      for (const id of new Set(ids)) {
        const list = byKana.get(id) ?? [];
        list.push(index);
        byKana.set(id, list);
      }
    });
    const recentWords: number[] = [];
    const known = (id: number): boolean => {
      const state = fold.state.items.get(keyOfId(id));
      return words?.of === 'introduced' ? state !== undefined : state?.phase === 'learned';
    };
    const readable = (index: number): boolean =>
      !recentWords.includes(index) && (pool[index] ?? []).every(known);
    /** A readable word among `indexes` (all words without), drawn on the word stream. */
    const drawWord = (indexes?: readonly number[]): Task | undefined => {
      const candidates = (indexes ?? pool.map((_, i) => i)).filter(readable);
      const index = candidates[Math.floor(wordRng.next() * candidates.length)];
      const word = index === undefined ? undefined : pool[index];
      if (index === undefined || word === undefined || word[0] === undefined) return undefined;
      recentWords.push(index);
      if (recentWords.length > (words?.recent ?? 0)) recentWords.shift();
      return { item: word[0], kind: 'word', options: [], review: false, word };
    };
    const fold: Fold = createFold(line === undefined ? { stats: false } : { stats: false, line });
    let n = 0;
    const emit = (event: LogEvent): void => {
      if (fold.apply(event) !== 'applied') {
        throw new Error(`event ${event.t} at ${event.at} did not apply`);
      }
    };
    const introduced = (id: number): boolean => fold.state.items.has(keyOfId(id));

    const ms = (value: number): number => Math.min(MS_CAP, Math.max(0, Math.round(value)));
    const keyOrNull = (id: number | undefined): LearnKanaKey | null =>
      id === undefined ? null : keyOfId(id);
    const recall = (
      at: number,
      id: number,
      ok: boolean,
      time: number,
      wrong: number | undefined,
    ): void => {
      emit({
        t: 'answer',
        at,
        dev: deviceOf(at),
        n: (n += 1),
        task: 'recall',
        k: keyOfId(id),
        ok,
        ms: ms(time),
        hint: false,
        wrong: keyOrNull(wrong),
        alt: null,
      });
    };
    function recordWord(answer: Answer): void {
      const reads = answer.reads ?? [];
      const mode = words?.mode ?? 'none';
      if (mode === 'none') return;
      if (mode === 'recalls') {
        for (const r of reads) recall(answer.at, r.item, r.ok, r.ms, r.confusedWith);
        return;
      }
      const text = reads.map((r) => ITEMS.get(keyOfId(r.item))?.kana ?? '').join('');
      emit({
        t: 'answer',
        at: answer.at,
        dev: deviceOf(answer.at),
        n: (n += 1),
        task: 'word',
        k: `word:${text}`,
        ok: answer.ok,
        ms: ms(answer.ms),
        hint: false,
        wrong: keyOrNull(answer.wrong),
        alt: null,
      });
      const miss = reads.find((r) => !r.ok);
      if (mode === 'again' && miss !== undefined)
        recall(answer.at, miss.item, false, miss.ms, miss.confusedWith);
    }

    const policy: Policy = {
      name: 'production model',
      learned: (id) => fold.state.items.get(keyOfId(id))?.phase === 'learned',
      session(): Session {
        let count = 0;
        let sinceWord = 0;
        let previous: LearnKanaKey | null = null;
        let closed = false;
        const seen = new Set<number>();
        const rechecks: { readonly id: number; readonly at: number }[] = [];
        // Whether words may come in this session: enough of them readable at its start.
        let wordsOpen: boolean | undefined;
        const open = (): boolean => {
          if (words === undefined) return false;
          if (words.minPool === undefined) return true;
          wordsOpen ??= pool.filter((_, i) => readable(i)).length >= words.minPool;
          return wordsOpen;
        };
        const closingWord = (): Task | undefined => {
          if (words?.closing !== true || closed || !open()) return undefined;
          closed = true;
          const inSession = pool.flatMap((ids, i) => (ids.every((id) => seen.has(id)) ? [i] : []));
          return drawWord(inSession);
        };
        const give = (task: Task): Task => {
          count += 1;
          for (const id of task.word ?? [task.item]) seen.add(id);
          return task;
        };
        let started = false;
        let ended = false;
        const finish = (now: number): void => {
          if (started && !ended) emit({ t: 'end', at: now, dev: deviceOf(now), n: (n += 1) });
          ended = true;
        };
        return {
          kind: 'learning',
          next(now) {
            if (ended) return undefined;
            if (!started) {
              emit({ t: 'start', at: now, dev: deviceOf(now), n: (n += 1), tz: 0 });
              started = true;
            }
            if (count >= SESSION_TASKS) {
              finish(now);
              return undefined;
            }
            if (count === SESSION_TASKS - 1) {
              const last = closingWord();
              if (last !== undefined) return give(last);
            }
            const recheckAt = rechecks.findIndex((r) => r.at <= count);
            const recheck = rechecks[recheckAt];
            if (recheck !== undefined) {
              rechecks.splice(recheckAt, 1);
              previous = keyOfId(recheck.id);
              return give({ item: recheck.id, kind: 'recall', options: [], review: false });
            }
            const every = words?.every;
            if (every !== undefined && sinceWord >= every && open()) {
              const word = drawWord();
              if (word !== undefined) {
                sinceWord = 0;
                return give(word);
              }
            }
            const planned = nextTask(fold.state, {
              now,
              track: trackOf(fold.state),
              previous,
              rng,
            });
            if (planned === null) {
              const last = closingWord();
              if (last !== undefined) return give(last);
              finish(now);
              return undefined;
            }
            sinceWord += 1;
            previous = planned.key;
            const id = idOf(planned.key);
            const carrier = words?.carrier;
            if (
              planned.kind === 'recall' &&
              carrier !== undefined &&
              open() &&
              wordRng.next() < carrier
            ) {
              const word = drawWord(byKana.get(id) ?? []);
              if (word !== undefined) return give(word);
            }
            const task: Task = {
              item: id,
              kind: planned.kind,
              options:
                planned.kind === 'recognition'
                  ? recognitionOptions(items, id, introduced, rng)
                  : [],
              review: planned.kind === 'recall' && planned.review,
            };
            return give(task);
          },
          record(answer: Answer) {
            const gap = options.recheck;
            if (gap !== undefined) {
              const wrong =
                answer.task.kind === 'word'
                  ? (answer.reads ?? []).filter((r) => !r.ok).map((r) => r.item)
                  : answer.task.kind !== 'introduction' && !answer.ok
                    ? [answer.task.item]
                    : [];
              for (const id of wrong) rechecks.push({ id, at: count + gap });
            }
            const key = keyOfId(answer.task.item);
            const base = { at: answer.at, dev: deviceOf(answer.at), n: (n += 1) };
            if (answer.task.kind === 'introduction') {
              emit({ ...base, t: 'intro', k: key });
              return;
            }
            if (answer.task.kind === 'word') {
              recordWord(answer);
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
