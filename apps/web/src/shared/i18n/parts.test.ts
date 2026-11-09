import { describe, it, expect, afterEach } from 'vitest';
import { pluralForm, setLocale, tParts, tPlural, tPluralParts } from './index';

afterEach(async () => {
  await setLocale('en');
});

describe('tParts', () => {
  it('splits a string into the text and the values of its parameters', () => {
    expect(tParts('learn.mastered', { done: 7, total: 104 })).toEqual([
      { text: 'mastered ', param: false },
      { text: '7', param: true },
      { text: ' of ', param: false },
      { text: '104', param: true },
    ]);
  });

  it('keeps a parameter at the start or the end, and a missing one as text', () => {
    expect(tParts('learn.review', { n: 3 })).toEqual([
      { text: 'review (', param: false },
      { text: '3', param: true },
      { text: ')', param: false },
    ]);
    expect(tParts('learn.review')).toEqual([{ text: 'review ({n})', param: false }]);
  });

  it('joins back to the string `t` gives', () => {
    const parts = tParts('learn.mastered', { done: 7, total: 104 });
    expect(parts.map((part) => part.text).join('')).toBe('mastered 7 of 104');
  });
});

describe('plural forms', () => {
  it('picks one and other in English', () => {
    expect(pluralForm(1)).toBe('one');
    expect(pluralForm(0)).toBe('other');
    expect(tPlural('learn.streak', 1)).toBe('streak: 1 day');
    expect(tPlural('learn.streak', 6)).toBe('streak: 6 days');
  });

  it('picks one, few and many in Russian', async () => {
    await setLocale('ru');
    const days = [0, 1, 2, 5, 11, 12, 21, 22, 25, 101].map((n) => tPlural('learn.streak', n));
    expect(days).toEqual([
      'серия: 0 дней',
      'серия: 1 день',
      'серия: 2 дня',
      'серия: 5 дней',
      'серия: 11 дней',
      'серия: 12 дней',
      'серия: 21 день',
      'серия: 22 дня',
      'серия: 25 дней',
      'серия: 101 день',
    ]);
  });

  it('gives the count to the parts as a value', () => {
    expect(tPluralParts('learn.streak', 3)).toEqual([
      { text: 'streak: ', param: false },
      { text: '3', param: true },
      { text: ' days', param: false },
    ]);
  });
});
