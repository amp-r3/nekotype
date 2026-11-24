import { describe, it, expect } from 'vitest';
import { signal } from '@preact/signals';
import type { LearnView, Reason } from '@nekotype/model';
import type { Track } from '@nekotype/shared/types';
import { REPLAN_MS } from '../lib/constants';
import { Clock0, Timers, intro, key, learnedEvents, viewOfEvents } from '../lib/test-util';
import { createHomeModel } from './home';

const DAY = 24 * 3600 * 1000;

function setup(options: { view?: LearnView | null; track?: Track; ready?: boolean } = {}) {
  const clock = new Clock0();
  const scheduler = new Timers();
  const view = signal<LearnView | null>(
    options.view === undefined ? viewOfEvents([]) : options.view,
  );
  const track = signal<Track>(options.track ?? 'hiragana');
  const ready = signal(options.ready ?? true);
  const reasons: (Reason | null)[] = [{ kind: 'new', key: key('あ'), row: 'hiragana:vowels' }];
  const calls: number[] = [];
  const asked: Track[] = [];
  const visible: (() => void)[] = [];
  const model = createHomeModel({
    track,
    view,
    ready,
    reasonAt: () => {
      calls.push(1);
      const next = reasons[0];
      return next === undefined ? null : structuredClone(next);
    },
    requestInsights: (value) => {
      asked.push(value);
    },
    clock,
    scheduler,
    visibility: {
      onVisible: (listener) => {
        visible.push(listener);
        return () => {
          visible.length = 0;
        };
      },
    },
  });
  return { model, clock, scheduler, view, track, ready, reasons, calls, asked, visible };
}

describe('home page model', () => {
  it('plans the reason when the store is ready, asks for the insights and can start', () => {
    const { model, asked } = setup();
    expect(model.reason.value).toEqual({ kind: 'new', key: key('あ'), row: 'hiragana:vowels' });
    expect(model.canStart.value).toBe(true);
    expect(asked).toEqual(['hiragana']);
    model.dispose();
  });

  it('does nothing before the store is ready, and cannot start', () => {
    const { model, asked, ready, view } = setup({ ready: false, view: null });
    expect(model.reason.value).toBeNull();
    expect(model.canStart.value).toBe(false);
    expect(asked).toEqual([]);
    ready.value = true;
    view.value = viewOfEvents([]);
    expect(model.reason.value).not.toBeNull();
    // Asking again is harmless: `requestInsights` does nothing for a request it already holds.
    expect(new Set(asked)).toEqual(new Set(['hiragana']));
    model.dispose();
  });

  it('cannot start with nothing to do (none), and the time of the next review is kept', () => {
    const { model, reasons, view } = setup();
    reasons[0] = { kind: 'none', nextAt: 123 };
    view.value = viewOfEvents([]);
    expect(model.reason.value).toEqual({ kind: 'none', nextAt: 123 });
    expect(model.canStart.value).toBe(false);
    model.dispose();
  });

  it('plans again when the view or the track changes, and asks again', () => {
    const { model, asked, track, view } = setup();
    view.value = viewOfEvents([]);
    track.value = 'katakana';
    expect(asked).toEqual(['hiragana', 'hiragana', 'katakana']);
    model.dispose();
  });

  it('plans again on its tick, and a tick that changes nothing sets nothing', () => {
    const { model, scheduler, calls, reasons } = setup();
    const before = model.reason.value;
    const seen: unknown[] = [];
    const stop = model.reason.subscribe((value) => seen.push(value));
    const initial = seen.length;
    expect(scheduler.tasks.size).toBe(1);
    scheduler.flush();
    expect(calls.length).toBe(2);
    expect(model.reason.value).toBe(before);
    expect(seen.length).toBe(initial);
    // The next tick is scheduled, and `nextAt` in the past turns into a review.
    expect(scheduler.tasks.size).toBe(1);
    reasons[0] = { kind: 'review', due: 2 };
    scheduler.flush();
    expect(model.reason.value).toEqual({ kind: 'review', due: 2 });
    expect(seen.length).toBe(initial + 1);
    stop();
    model.dispose();
  });

  it('plans again when the tab becomes visible', () => {
    const { model, visible, reasons } = setup();
    reasons[0] = { kind: 'learning', learning: 3 };
    visible[0]?.();
    expect(model.reason.value).toEqual({ kind: 'learning', learning: 3 });
    model.dispose();
  });

  it('dispose stops the effect, the timer and the listener: nothing runs in a session', () => {
    const { model, scheduler, asked, view, visible, calls } = setup();
    model.dispose();
    expect(scheduler.tasks.size).toBe(0);
    expect(visible).toHaveLength(0);
    view.value = viewOfEvents([]);
    expect(asked).toEqual(['hiragana']);
    expect(calls).toHaveLength(1);
  });

  it('the tick is REPLAN_MS', () => {
    expect(REPLAN_MS).toBe(60_000);
  });

  it('the streak is null before the first answer and counts days after it', () => {
    const empty = setup();
    expect(empty.model.first.value).toBe(true);
    expect(empty.model.streak.value).toBeNull();
    empty.model.dispose();

    const clock = new Clock0();
    const view = viewOfEvents(learnedEvents('あ', clock.time - DAY / 2));
    const answered = setup({ view });
    expect(answered.model.first.value).toBe(false);
    expect(answered.model.streak.value).toBe(1);
    answered.model.dispose();
  });

  it('the streak is 0, not null, after a missed day', () => {
    const view = viewOfEvents(learnedEvents('あ', 1_700_000_000_000 - 3 * DAY));
    const missed = setup({ view });
    expect(missed.model.first.value).toBe(false);
    expect(missed.model.streak.value).toBe(0);
    missed.model.dispose();
  });

  it('suggests katakana only on hiragana, once the basic hiragana are learned and katakana is not started', () => {
    const view = viewOfEvents(basicLearned());
    const on = setup({ view });
    expect(on.model.suggestKatakana.value).toBe(true);
    on.track.value = 'katakana';
    expect(on.model.suggestKatakana.value).toBe(false);
    on.model.dispose();

    const started = setup({
      view: viewOfEvents([...basicLearned(), intro('katakana:ア', { at: 1_700_000_100_000 })]),
    });
    expect(started.model.suggestKatakana.value).toBe(false);
    started.model.dispose();
  });
});

function basicLearned() {
  const kana = Array.from(
    'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん',
  );
  return kana.flatMap((k, i) => learnedEvents(k, 1_700_000_000_000 + i * 500_000));
}
