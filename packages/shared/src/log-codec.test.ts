import { describe, expect, it } from 'vitest';
import { MAX_PAGE_EVENTS, decodePage, encodePage, isLogPage } from './runtime';
import type { LogEvent, LogPage } from './types';

const DEV = '11111111-1111-4111-8111-111111111111';

const events: readonly LogEvent[] = [
  { at: 1_000, dev: DEV, n: 5, t: 'start', tz: 180 },
  { at: 1_000, dev: DEV, n: 6, t: 'intro', k: 'hiragana:あ' },
  {
    at: 4_200,
    dev: DEV,
    n: 7,
    t: 'answer',
    task: 'recall',
    k: 'hiragana:あ',
    ok: true,
    ms: 812,
    hint: false,
    wrong: null,
    alt: null,
    misses: 0,
    w: null,
  },
  {
    at: 9_000,
    dev: DEV,
    n: 8,
    t: 'answer',
    task: 'contrast',
    k: 'katakana:シ',
    ok: false,
    ms: 10_000,
    hint: true,
    wrong: 'katakana:ツ',
    alt: 'katakana:ツ',
    misses: 0,
    w: null,
  },
  {
    at: 9_001,
    dev: DEV,
    n: 9,
    t: 'answer',
    task: 'word',
    k: 'word:ねこ',
    ok: true,
    ms: 0,
    hint: false,
    wrong: null,
    alt: null,
    misses: 0,
    w: null,
  },
  { at: 12_000, dev: DEV, n: 10, t: 'end' },
];

function ev(index: number): LogEvent {
  const event = events[index];
  if (event === undefined) throw new Error('no event');
  return event;
}

const page = (): LogPage => encodePage(events);
const answer = ['a', 'recall', 'hiragana:あ', 1, 5, 0, '', ''] as const;

describe('log codec', () => {
  it('round-trips every kind of event, with relative times and null as an empty string', () => {
    const encoded = page();
    expect(encoded.n0).toBe(5);
    expect(encoded.at0).toBe(1_000);
    expect(encoded.e.map((event) => event[0])).toEqual([0, 0, 3_200, 4_800, 1, 2_999]);
    expect(encoded.e[2]).toEqual([3_200, 'a', 'recall', 'hiragana:あ', 1, 812, 0, '', '']);
    expect(decodePage(JSON.parse(JSON.stringify(encoded)))).toEqual(events);
  });

  it('refuses to encode what is not one device, without gaps and in time order', () => {
    expect(() => encodePage([])).toThrow();
    expect(() => encodePage([ev(0), ev(2)])).toThrow(/gaps/);
    expect(() => encodePage([ev(1), ev(0)])).toThrow();
    expect(() => encodePage([ev(0), { ...ev(1), dev: 'b', n: 6 }])).toThrow(/device/);
    expect(() => encodePage([ev(1), { ...ev(0), n: 7, at: 999 }])).toThrow(/decrease/);
  });

  it('accepts a page and rejects every broken bound', () => {
    const ok = page();
    expect(isLogPage(ok)).toBe(true);
    const bad: [string, unknown][] = [
      ['not an object', null],
      ['a key more', { ...ok, extra: 1 }],
      ['dev not a UUID', { ...ok, dev: 'device-a' }],
      ['n0 zero', { ...ok, n0: 0 }],
      ['n0 fraction', { ...ok, n0: 1.5 }],
      ['at0 negative', { ...ok, at0: -1 }],
      ['no events', { ...ok, e: [] }],
      ['dt negative', { ...ok, e: [[-1, 'e']] }],
      ['dt fraction', { ...ok, e: [[0.5, 'e']] }],
      ['unknown kind', { ...ok, e: [[0, 'x']] }],
      ['end with a field', { ...ok, e: [[0, 'e', 1]] }],
      ['intro with a word', { ...ok, e: [[0, 'i', 'word:ねこ']] }],
      ['intro key too long', { ...ok, e: [[0, 'i', `hiragana:${'あ'.repeat(16)}`]] }],
      ['tz too low', { ...ok, e: [[0, 's', -721]] }],
      ['tz too high', { ...ok, e: [[0, 's', 841]] }],
      ['unknown task', { ...ok, e: [[0, ...answer].map((x, i) => (i === 2 ? 'typing' : x))] }],
      ['word key with recall', { ...ok, e: [[0, 'a', 'recall', 'word:ねこ', 1, 5, 0, '', '']] }],
      ['ok 2', { ...ok, e: [[0, 'a', 'recall', 'hiragana:あ', 2, 5, 0, '', '']] }],
      ['hint true', { ...ok, e: [[0, 'a', 'recall', 'hiragana:あ', 1, 5, true, '', '']] }],
      ['ms 10001', { ...ok, e: [[0, 'a', 'recall', 'hiragana:あ', 1, 10_001, 0, '', '']] }],
      ['ms fraction', { ...ok, e: [[0, 'a', 'recall', 'hiragana:あ', 1, 5.5, 0, '', '']] }],
      ['wrong not a kana', { ...ok, e: [[0, 'a', 'recall', 'hiragana:あ', 0, 5, 0, 'x', '']] }],
      ['alt null', { ...ok, e: [[0, 'a', 'recall', 'hiragana:あ', 0, 5, 0, '', null]] }],
      ['answer one field short', { ...ok, e: [[0, 'a', 'recall', 'hiragana:あ', 1, 5, 0, '']] }],
      ['answer one field long', { ...ok, e: [[0, ...answer, 1, 'ねこ', 1]] }],
      ['misses 10', { ...ok, e: [[0, ...answer, 10]] }],
      ['misses negative', { ...ok, e: [[0, ...answer, -1]] }],
      ['misses fraction', { ...ok, e: [[0, ...answer, 1.5]] }],
      ['w empty', { ...ok, e: [[0, ...answer, 0, '']] }],
      ['w null', { ...ok, e: [[0, ...answer, 0, null]] }],
      ['w of 33 characters', { ...ok, e: [[0, ...answer, 0, 'あ'.repeat(33)]] }],
      ['rule with recall', { ...ok, e: [[0, 'a', 'recall', 'rule:sokuon', 1, 0, 0, '', '']] }],
      ['unknown rule', { ...ok, e: [[0, 'a', 'word', 'rule:x', 1, 0, 0, '', '']] }],
      ['intro of an unknown rule', { ...ok, e: [[0, 'i', 'rule:x']] }],
      ['rule as wrong', { ...ok, e: [[0, 'a', 'word', 'hiragana:あ', 0, 5, 0, 'rule:choon', '']] }],
      ['mismatch of a word', { ...ok, e: [[0, 'a', 'mismatch', 'word:ねこ', 1, 5, 0, '', '']] }],
      ['script of a rule', { ...ok, e: [[0, 'a', 'script', 'rule:choon', 1, 5, 0, '', '']] }],
      ['at overflows', { ...ok, at0: Number.MAX_SAFE_INTEGER, e: [[1, 'e']] }],
    ];
    for (const [name, value] of bad) expect([name, isLogPage(value)]).toEqual([name, false]);
    expect(decodePage(bad[1]?.[1])).toBeNull();
  });

  it('writes an answer in the shortest of its three forms and reads each back', () => {
    const base = ev(2);
    if (base.t !== 'answer') throw new Error('not an answer');
    const forms: readonly LogEvent[] = [
      base,
      { ...base, n: 8, misses: 9 },
      { ...base, n: 9, task: 'word', w: 'あ'.repeat(32) },
      { ...base, n: 10, task: 'word', k: 'rule:sokuon', misses: 2, w: 'きって' },
      { ...base, n: 11, task: 'mismatch', alt: 'hiragana:い' },
      { ...base, n: 12, task: 'script' },
    ];
    const encoded = encodePage(forms);
    expect(encoded.e.map((event) => event.length)).toEqual([9, 10, 11, 11, 9, 9]);
    expect(encoded.e[2]?.slice(9)).toEqual([0, 'あ'.repeat(32)]);
    expect(decodePage(JSON.parse(JSON.stringify(encoded)))).toEqual(forms);
  });

  it('takes an introduction of a rule', () => {
    const rule: LogEvent = { at: 1_000, dev: DEV, n: 1, t: 'intro', k: 'rule:choon' };
    expect(decodePage(encodePage([rule]))).toEqual([rule]);
  });

  it('reads a page of format 3 with no misses and no word, and writes its bytes again', () => {
    const stored = JSON.stringify({
      dev: DEV,
      n0: 1,
      at0: 1_000,
      e: [
        [0, 'i', 'hiragana:あ'],
        [5, ...answer],
        [7, 'a', 'word', 'word:ねこ', 0, 0, 0, '', ''],
      ],
    });
    const events = decodePage(JSON.parse(stored));
    expect(events?.slice(1)).toMatchObject([
      { misses: 0, w: null },
      { misses: 0, w: null },
    ]);
    expect(JSON.stringify(encodePage(events ?? []))).toBe(stored);
  });

  it('holds at most MAX_PAGE_EVENTS events', () => {
    const many = (count: number): unknown => ({
      ...page(),
      e: Array.from({ length: count }, () => [0, 'e']),
    });
    expect(isLogPage(many(MAX_PAGE_EVENTS))).toBe(true);
    expect(isLogPage(many(MAX_PAGE_EVENTS + 1))).toBe(false);
  });
});
