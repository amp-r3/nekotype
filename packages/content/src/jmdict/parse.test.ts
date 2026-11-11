import { describe, expect, it } from 'vitest';
import { entityNames, parseJmdict } from './parse';

const FIXTURE = new URL('../../fixtures/jmdict-sample.xml', import.meta.url).pathname;

describe('entityNames', () => {
  it('lists the declared entities', () => {
    expect(entityNames('<!ENTITY sk "search-only"> <!ENTITY uk "kana alone">')).toEqual([
      'sk',
      'uk',
    ]);
  });
});

describe('parseJmdict', () => {
  it('reads entities as their own names and keeps the reading flags', async () => {
    const entries = await parseJmdict(FIXTURE, null);
    const entry = entries.get(1000002);
    expect(entry?.readings.map((r) => [r.text, r.searchOnly])).toEqual([
      ['こちら', false],
      ['こっち', false],
      ['こち', true],
    ]);
  });

  it('reads stagr, glosses by language and priority tags', async () => {
    const entries = await parseJmdict(FIXTURE, null);
    expect(entries.get(1000002)?.senses.map((s) => s.stagr)).toEqual([
      undefined,
      ['こちら'],
      ['こっち'],
    ]);
    const meet = entries.get(1000001);
    expect(meet?.senses.map((s) => [s.glossEn, s.glossRu])).toEqual([
      [['to meet', 'to encounter'], []],
      [['to see'], []],
      [[], ['встречаться']],
      [['to have an accident'], []],
    ]);
    expect(meet?.readings[0]?.pri).toEqual(['ichi1', 'nf26']);
    expect(meet?.kanji[0]).toEqual({ text: '会う', pri: ['ichi1'] });
  });

  it('keeps only the wanted entries', async () => {
    const entries = await parseJmdict(FIXTURE, new Set([1000003]));
    expect([...entries.keys()]).toEqual([1000003]);
  });
});
