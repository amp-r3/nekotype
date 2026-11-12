import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { isObject, isTestConfig, isSettings } from './runtime';

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

  describe('isSettings', () => {
    const valid = {
      typing: {
        script: 'both',
        content: 'words',
        strictness: 'learner',
        weakFocus: true,
        test: { kind: 'time', seconds: 30 },
        showTranslation: true,
      },
      learn: { strictness: 'learner', track: 'hiragana', targetMs: 1500, sound: true },
      updatedAt: 0,
    };
    const withTyping = (patch: Record<string, unknown>): unknown => ({
      ...valid,
      typing: { ...valid.typing, ...patch },
    });
    const withLearn = (patch: Record<string, unknown>): unknown => ({
      ...valid,
      learn: { ...valid.learn, ...patch },
    });

    it('accepts the spec shape', () => {
      expect(isSettings(valid)).toBe(true);
      expect(isSettings(withTyping({ test: { kind: 'zen' } }))).toBe(true);
    });

    it('rejects the removed single-kana content and an unknown test (ADR 061)', () => {
      expect(isSettings(withTyping({ content: 'single' }))).toBe(false);
      expect(isSettings(withTyping({ test: { kind: 'sudden-death' } }))).toBe(false);
    });

    it('requires showTranslation to be a boolean', () => {
      const rest: Record<string, unknown> = { ...valid.typing };
      delete rest['showTranslation'];
      expect(isSettings({ ...valid, typing: rest })).toBe(false);
      expect(isSettings(withTyping({ showTranslation: 'no' }))).toBe(false);
    });

    it('accepts targetMs from 1000 to 3000 in steps of 250 only', () => {
      for (const ms of [1000, 1250, 1500, 2750, 3000]) {
        expect(isSettings(withLearn({ targetMs: ms }))).toBe(true);
      }
      for (const ms of [750, 1100, 3250, '1500', Number.NaN]) {
        expect(isSettings(withLearn({ targetMs: ms }))).toBe(false);
      }
    });

    it('checks the learning fields and updatedAt', () => {
      expect(isSettings(withLearn({ track: 'both' }))).toBe(false);
      expect(isSettings(withLearn({ strictness: 'x' }))).toBe(false);
      expect(isSettings(withLearn({ sound: 1 }))).toBe(false);
      expect(isSettings({ ...valid, updatedAt: '0' })).toBe(false);
      expect(isSettings({ typing: valid.typing, updatedAt: 0 })).toBe(false);
      // The old flat shape is not valid any more.
      expect(isSettings({ v: 1, ...valid.typing })).toBe(false);
    });
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
