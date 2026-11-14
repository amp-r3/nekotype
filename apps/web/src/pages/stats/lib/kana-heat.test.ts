import { describe, it, expect } from 'vitest';
import { heatRows, heatStep, typedScripts } from './kana-heat';

const stat = (errored: number, attempts: number) => ({ attempts, erroredAttempts: errored });

describe('heatStep', () => {
  it('has no step without an entry or attempts', () => {
    expect(heatStep(undefined)).toBeNull();
    expect(heatStep(stat(0, 0))).toBeNull();
  });

  it('steps over 0, 3, 7, 12 and 20 %', () => {
    expect(heatStep(stat(0, 100))).toBe(0);
    expect(heatStep(stat(1, 100))).toBe(1);
    expect(heatStep(stat(3, 100))).toBe(1);
    expect(heatStep(stat(31, 1000))).toBe(2);
    expect(heatStep(stat(7, 100))).toBe(2);
    expect(heatStep(stat(71, 1000))).toBe(3);
    expect(heatStep(stat(12, 100))).toBe(3);
    expect(heatStep(stat(121, 1000))).toBe(4);
    expect(heatStep(stat(20, 100))).toBe(4);
    expect(heatStep(stat(201, 1000))).toBe(5);
  });
});

describe('heatRows', () => {
  it('gives each kana its step, rate and attempts', () => {
    const rows = heatRows('hiragana', { 'hiragana:あ': stat(1, 10) });
    const cells = rows.flatMap((row) => row.cells).filter((cell) => cell !== null);
    const a = cells.find((cell) => cell.kana === 'あ');
    expect(a).toMatchObject({ step: 3, rate: 0.1, attempts: 10, romaji: 'a' });
    expect(cells.find((cell) => cell.kana === 'い')).toMatchObject({ step: null, attempts: 0 });
    expect(cells.find((cell) => cell.kana === 'ん')?.romaji).toBe('n');
  });
});

describe('typedScripts', () => {
  it('reads the scripts from the attempts of the kana', () => {
    expect(typedScripts({})).toEqual({ hiragana: false, katakana: false });
    expect(typedScripts({ 'hiragana:あ': stat(0, 3) })).toEqual({
      hiragana: true,
      katakana: false,
    });
    expect(typedScripts({ 'katakana:ア': stat(1, 1) })).toEqual({
      hiragana: false,
      katakana: true,
    });
    expect(typedScripts({ 'hiragana:あ': stat(0, 3), 'katakana:ア': stat(0, 1) })).toEqual({
      hiragana: true,
      katakana: true,
    });
  });

  it('does not count an entry with no attempts', () => {
    expect(typedScripts({ 'hiragana:あ': stat(0, 0) })).toEqual({
      hiragana: false,
      katakana: false,
    });
  });
});
