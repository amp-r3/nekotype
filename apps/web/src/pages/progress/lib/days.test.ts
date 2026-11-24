import { describe, expect, it } from 'vitest';
import { mondayOf } from './days';

describe('mondayOf', () => {
  it('maps every day of a week to its Monday, also before day 0', () => {
    for (let day = 4; day <= 10; day++) expect(mondayOf(day)).toBe(4);
    expect(mondayOf(-3)).toBe(-3);
    expect(mondayOf(0)).toBe(-3);
  });
});
