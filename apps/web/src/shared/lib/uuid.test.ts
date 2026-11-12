import { describe, it, expect } from 'vitest';
import { uuidv7 } from './uuid';

const zeros = (n: number): Uint8Array => new Uint8Array(n);
const ones = (n: number): Uint8Array => new Uint8Array(n).fill(0xff);

describe('uuidv7', () => {
  it('writes the time in the first 48 bits', () => {
    // 0x01_9a_bc_de_f0_12 ms
    expect(uuidv7(0x019abcdef012, zeros)).toBe('019abcde-f012-7000-8000-000000000000');
  });

  it('sets the version and the variant over random bits', () => {
    expect(uuidv7(0, ones)).toBe('00000000-0000-7fff-bfff-ffffffffffff');
  });

  it('sorts later ids after earlier ones', () => {
    const early = uuidv7(1_700_000_000_000, ones);
    const late = uuidv7(1_700_000_000_001, zeros);
    expect(early < late).toBe(true);
  });

  it('matches the UUID format with the default random source', () => {
    expect(uuidv7(Date.now())).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
