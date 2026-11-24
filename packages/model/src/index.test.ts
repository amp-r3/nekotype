import { describe, expect, it } from 'vitest';
import * as model from './index';
import { answer, end, intro, start } from './testing';

describe('@nekotype/model', () => {
  it('exports the constants of D9 as simulated (candidate A4)', () => {
    expect(model).toMatchObject({
      LEARN_MAX: 5,
      STEP_MS: 30_000,
      GRADUATE: 5,
      RETENTION: 0.9,
      RETENTION_MAX: 0.98,
      GOAL: 0.9,
      ADAPT_RATE: 0.05,
      PRESSURE_SPAN: 0.1,
      EXTRA_RECALLS_MAX: 2,
      GAP_MIN_MS: 3_600_000,
      GAPS_KEPT: 10,
      HORIZON_DEFAULT_MS: 43_200_000,
      SESSION_TASKS: 30,
      RECOGNITION_SHARE: 0.25,
      TRACK_LAG: 10,
      MASTERED_STABILITY_DAYS: 21,
      RECENT_RECALLS: 10,
      OUTCOMES_KEPT: 200,
      OUTCOMES_MIN: 20,
      SITTINGS_KEPT: 10,
      SITTING_DEFAULT_MS: 300_000,
      TASK_MS_KEPT: 200,
      TASK_DEFAULT_MS: 4_000,
      PLAY_OK_MS: 1_200,
      PLAY_WRONG_MS: 2_500,
      FORECAST_PLAYS: 10,
      FORECAST_MAX_SESSIONS: 60,
      FORECAST_MAX_SITTINGS: 240,
      FORECAST_HISTORY: 10,
      FORECAST_HISTORY_MIN: 3,
      DAY_MS: 86_400_000,
    });
  });
});

describe('event builders', () => {
  it('build events of the four types with overrides', () => {
    expect(intro('hiragana:あ', { at: 5 })).toEqual({
      t: 'intro',
      k: 'hiragana:あ',
      at: 5,
      dev: 'd1',
      n: 1,
    });
    expect(answer('hiragana:あ', { ok: false, n: 2 })).toMatchObject({
      t: 'answer',
      task: 'recall',
      ok: false,
      n: 2,
      hint: false,
      wrong: null,
      alt: null,
    });
    expect(start(540, { dev: 'd2' })).toEqual({ t: 'start', tz: 540, at: 0, dev: 'd2', n: 1 });
    expect(end({ at: 9 })).toEqual({ t: 'end', at: 9, dev: 'd1', n: 1 });
  });
});
