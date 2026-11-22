import { describe, expect, it } from 'vitest';
import { compareEvents, eventKey, localDay } from './order';

const id = (at: number, dev: string, n: number) => ({ at, dev, n });

describe('compareEvents', () => {
  it('orders by at, then dev, then n', () => {
    expect(compareEvents(id(1, 'b', 9), id(2, 'a', 1))).toBe(-1);
    expect(compareEvents(id(2, 'a', 1), id(1, 'b', 9))).toBe(1);
    expect(compareEvents(id(1, 'a', 9), id(1, 'b', 1))).toBe(-1);
    expect(compareEvents(id(1, 'b', 1), id(1, 'a', 9))).toBe(1);
    expect(compareEvents(id(1, 'a', 1), id(1, 'a', 2))).toBe(-1);
    expect(compareEvents(id(1, 'a', 2), id(1, 'a', 1))).toBe(1);
    expect(compareEvents(id(1, 'a', 1), id(1, 'a', 1))).toBe(0);
  });
});

describe('eventKey', () => {
  it('is dev and n', () => {
    expect(eventKey(id(5, 'abc', 7))).toBe('abc:7');
  });
});

describe('localDay', () => {
  const DAY = 86_400_000;
  it('is the UTC day at offset 0', () => {
    expect(localDay(0, 0)).toBe(0);
    expect(localDay(DAY - 1, 0)).toBe(0);
    expect(localDay(DAY, 0)).toBe(1);
  });
  it('follows the local midnight east and west of UTC', () => {
    expect(localDay(DAY - 1, 60)).toBe(1); // 00:59 local, next day
    expect(localDay(DAY - 1, -60)).toBe(0);
    expect(localDay(DAY, -60)).toBe(0); // 23:00 local the day before
  });
});
