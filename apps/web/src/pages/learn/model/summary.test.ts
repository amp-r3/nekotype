import { describe, it, expect, vi } from 'vitest';
import { signal } from '@preact/signals';
import type { Reason } from '@nekotype/model';
import type { Track } from '@nekotype/shared/types';
import type { Insights, ShownForecast } from '@/entities/learn';
import { createSummaryModel } from './summary';

const forecast = (median: number): ShownForecast => ({
  row: 'hiragana:k',
  low: median - 1,
  median,
  high: median + 1,
  raw: median,
  basis: 'corrected',
});

const insightsOf = (version: number, median: number, track: Track = 'hiragana'): Insights => ({
  version,
  track,
  outline: null,
  stronger: { kind: 'pending' },
  forecast: { kind: 'ready', forecast: forecast(median) },
});

function setup(options: { before?: ShownForecast | null; reason?: Reason | null } = {}) {
  const version = signal(1);
  const insights = signal<Insights | null>(null);
  const requestInsights = vi.fn();
  const reasonAt = vi.fn<() => Reason | null>(
    () => options.reason ?? { kind: 'learning', learning: 2 },
  );
  const model = createSummaryModel({
    track: 'hiragana',
    before: options.before ?? null,
    version,
    insights,
    requestInsights,
    reasonAt,
    clock: { now: () => 1000 },
  });
  return { model, version, insights, requestInsights, reasonAt };
}

describe('summary model', () => {
  it('asks for the insights of the session track when it is made, and again when the view changes', () => {
    const env = setup();
    expect(env.requestInsights).toHaveBeenCalledTimes(1);
    expect(env.requestInsights).toHaveBeenLastCalledWith('hiragana');
    env.version.value = 2;
    expect(env.requestInsights).toHaveBeenCalledTimes(2);
    env.model.dispose();
    env.version.value = 3;
    expect(env.requestInsights).toHaveBeenCalledTimes(2);
  });

  it('keeps the forecast pending until the insights of this version and track are there', () => {
    const before = forecast(3);
    const env = setup({ before });
    expect(env.model.change.value).toEqual({ before, after: { kind: 'pending' } });
    // The home's insights of the version before the session's end are not "after".
    env.insights.value = insightsOf(0, 3);
    expect(env.model.change.value.after).toEqual({ kind: 'pending' });
    env.insights.value = insightsOf(1, 2, 'katakana');
    expect(env.model.change.value.after).toEqual({ kind: 'pending' });
    env.insights.value = insightsOf(1, 2);
    expect(env.model.change.value).toEqual({
      before,
      after: { kind: 'ready', forecast: forecast(2) },
    });
    // A newer view makes it pending again until the new request has published.
    env.version.value = 2;
    expect(env.model.change.value.after).toEqual({ kind: 'pending' });
  });

  it('may start unless the planner offers nothing', () => {
    expect(setup().model.canStart.value).toBe(true);
    expect(setup({ reason: { kind: 'none', nextAt: 5 } }).model.canStart.value).toBe(false);
    expect(setup({ reason: { kind: 'none', nextAt: 5 } }).model.reason.value).toEqual({
      kind: 'none',
      nextAt: 5,
    });
  });

  it('plans again when the view changes, so a session that ended early reads its end', () => {
    const env = setup();
    expect(env.model.canStart.value).toBe(true);
    env.reasonAt.mockReturnValue({ kind: 'none', nextAt: 9 });
    env.version.value = 2;
    expect(env.model.canStart.value).toBe(false);
  });

  it('cannot start before the store is ready', () => {
    const env = setup();
    env.reasonAt.mockReturnValue(null);
    env.version.value = 2;
    expect(env.model.canStart.value).toBe(false);
  });
});
