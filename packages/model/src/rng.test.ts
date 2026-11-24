import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seededRng } from './rng';
import { syntheticLog } from './testing';

describe('seededRng', () => {
  it('repeats for a seed, differs for another, and stays in [0, 1)', () => {
    const draw = (seed: number) => {
      const rng = seededRng(seed);
      return Array.from({ length: 50 }, () => rng.next());
    };
    expect(draw(7)).toEqual(draw(7));
    expect(draw(7)).not.toEqual(draw(8));
    for (const x of draw(7)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('keeps the generator of syntheticLog: the same log as before the move', () => {
    const events = syntheticLog({ answers: 1000, seed: 1 });
    expect(events).toHaveLength(1083);
    expect(createHash('sha256').update(JSON.stringify(events)).digest('hex')).toBe(
      '7ae1a83372d1d2830c990c3ebb9e527700f9269f071df23627ab2cad62734f6e',
    );
  });
});
