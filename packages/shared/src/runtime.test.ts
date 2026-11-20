import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { isObject, isSettings } from './runtime';

describe('shared/runtime guards', () => {
  it('isObject accepts plain objects only', () => {
    expect(isObject({})).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject('x')).toBe(false);
  });

  describe('isSettings', () => {
    const valid = {
      learn: { strictness: 'learner', track: 'hiragana', targetMs: 1500, sound: true },
      updatedAt: 0,
    };
    const withLearn = (patch: Record<string, unknown>): unknown => ({
      ...valid,
      learn: { ...valid.learn, ...patch },
    });

    it('accepts the spec shape', () => {
      expect(isSettings(valid)).toBe(true);
    });

    it('rejects a document with a typing block or any other key', () => {
      const typing = { script: 'both', content: 'words' };
      expect(isSettings({ ...valid, typing })).toBe(false);
      expect(isSettings({ ...valid, extra: 1 })).toBe(false);
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
      expect(isSettings({ updatedAt: 0 })).toBe(false);
      expect(isSettings({ learn: valid.learn })).toBe(false);
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
