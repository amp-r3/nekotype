import { describe, it, expect } from 'vitest';
import { initialSection, parseSection } from './section';

describe('parseSection', () => {
  it.each([
    ['#learning', 'learning'],
    ['#typing', 'typing'],
    ['typing', 'typing'],
    ['', null],
    ['#', null],
    ['#Typing', null],
    ['#learning2', null],
    ['#activity', null],
  ])('reads %j as %j', (hash, section) => {
    expect(parseSection(hash)).toBe(section);
  });
});

describe('initialSection', () => {
  const none = { learning: false, typing: false };

  it('lets a valid hash win over the data', () => {
    expect(initialSection('#typing', { learning: true, typing: false })).toBe('typing');
    expect(initialSection('#learning', { learning: false, typing: true })).toBe('learning');
  });

  it('opens the section that has data, learning when both have it or neither does', () => {
    expect(initialSection('', { learning: true, typing: false })).toBe('learning');
    expect(initialSection('', { learning: false, typing: true })).toBe('typing');
    expect(initialSection('', { learning: true, typing: true })).toBe('learning');
    expect(initialSection('', none)).toBe('learning');
  });

  it('ignores an invalid hash', () => {
    expect(initialSection('#nope', { learning: false, typing: true })).toBe('typing');
  });
});
