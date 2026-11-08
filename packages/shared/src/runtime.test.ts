import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { isObject, isTestConfig, isKanaStats, isSettings } from './runtime';

describe('shared/runtime guards', () => {
  it('isObject accepts plain objects only', () => {
    expect(isObject({})).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject('x')).toBe(false);
  });

  it('isTestConfig accepts the allowed durations and counts, and zen', () => {
    expect(isTestConfig({ kind: 'time', seconds: 60 })).toBe(true);
    expect(isTestConfig({ kind: 'count', prompts: 25 })).toBe(true);
    // Spec metrics.md: TestResult.config is time, count or zen.
    expect(isTestConfig({ kind: 'zen' })).toBe(true);
    expect(isTestConfig({ kind: 'time', seconds: 45 })).toBe(false);
    expect(isTestConfig({ kind: 'count', prompts: 7 })).toBe(false);
    expect(isTestConfig({ kind: 'marathon' })).toBe(false);
    expect(isTestConfig({ kind: 'time' })).toBe(false);
    expect(isTestConfig(null)).toBe(false);
  });

  // Zen is an addition: what was saved before it existed still passes, so no migration is needed.
  describe('isSettings with a zen test', () => {
    const settings = (test: unknown): unknown => ({
      v: 1,
      script: 'both',
      content: 'words',
      strictness: 'learner',
      weakFocus: true,
      test,
    });

    it('accepts the settings saved before zen existed', () => {
      expect(isSettings(settings({ kind: 'time', seconds: 30 }))).toBe(true);
      expect(isSettings(settings({ kind: 'count', prompts: 25 }))).toBe(true);
    });

    it('accepts a zen test and still rejects an unknown one', () => {
      expect(isSettings(settings({ kind: 'zen' }))).toBe(true);
      expect(isSettings(settings({ kind: 'sudden-death' }))).toBe(false);
      expect(isSettings(settings(undefined))).toBe(false);
    });
  });

  // showTranslation was added to v1 as an optional field (spec storage-sync.md, D18).
  describe('isSettings with showTranslation', () => {
    const base = {
      v: 1,
      script: 'both',
      content: 'words',
      strictness: 'learner',
      weakFocus: true,
      test: { kind: 'time', seconds: 30 },
    };

    it('rejects the removed single-kana content and a row selection is ignored (ADR 061)', () => {
      expect(isSettings({ ...base, content: 'single' })).toBe(false);
      expect(isSettings({ ...base, rowIds: ['vowels'] })).toBe(true);
    });

    it('accepts settings saved without the field, and with a boolean', () => {
      expect(isSettings(base)).toBe(true);
      expect(isSettings({ ...base, showTranslation: false })).toBe(true);
      expect(isSettings({ ...base, showTranslation: true })).toBe(true);
    });

    it('rejects a value that is not a boolean', () => {
      expect(isSettings({ ...base, showTranslation: 'no' })).toBe(false);
      expect(isSettings({ ...base, showTranslation: null })).toBe(false);
    });
  });

  it('isKanaStats requires numeric a, m and t', () => {
    expect(isKanaStats({ a: 1, m: 0, t: 300 })).toBe(true);
    expect(isKanaStats({ a: '1', m: 0, t: 300 })).toBe(false);
    expect(isKanaStats({ a: 1, m: 0 })).toBe(false);
  });
});

describe('shared/runtime import restrictions', { timeout: 20000 }, () => {
  const eslint = new ESLint();

  it('rejects importing valibot or schemas', async () => {
    const [result] = await eslint.lintText(
      "import { object } from 'valibot';\nimport { s } from './schemas';\nexport const x = [object, s];\n",
      { filePath: 'src/runtime.ts' },
    );
    const hits = (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-imports');
    expect(hits.length).toBe(2);
  });
});
