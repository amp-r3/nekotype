import { describe, expect, it } from 'vitest';
import { isSources, loadSources, parseSources } from './sources';

describe('sources.json', () => {
  it('matches the guard', () => {
    const sources = loadSources();
    expect(sources.sources.length).toBeGreaterThan(0);
    expect(new Set(sources.sources.map((s) => s.id)).size).toBe(sources.sources.length);
    expect(new Set(sources.sources.map((s) => s.file)).size).toBe(sources.sources.length);
  });

  it('pins every file by a sha256', () => {
    for (const s of loadSources().sources) {
      expect(s.sha256, s.id).toMatch(/^[0-9a-f]{64}$/);
      expect(s.bytes, s.id).toBeGreaterThan(0);
      expect(s.mirror, s.id).toMatch(
        /^https:\/\/github\.com\/amp-r3\/nekotype\/releases\/download\//,
      );
    }
  });

  it('rejects a malformed file', () => {
    expect(isSources(null)).toBe(false);
    expect(isSources({ jlptCommit: 'x', release: 'y', sources: [{ id: 1 }] })).toBe(false);
    expect(() => parseSources('{}')).toThrow();
  });
});
