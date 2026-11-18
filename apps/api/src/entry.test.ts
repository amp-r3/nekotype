import { describe, expect, it } from 'vitest';

// The tests run inside workerd, which has no file system: the sources come in through Vite.
const entry = import.meta.glob<string>('../../../functions/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const sources = import.meta.glob<string>(['./**/*.ts', '!./**/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const deployed = { ...entry, ...sources };

describe('the Functions entry (p5-plan.md, D1)', () => {
  it('is the one line that re-exports onRequest from apps/api', () => {
    const files = Object.entries(entry);
    expect(files.map(([path]) => path)).toEqual(['../../../functions/api/[[route]].ts']);
    expect(files[0]?.[1]).toBe("export { onRequest } from '../../apps/api/src/pages-entry';\n");
  });
});

describe('the deployed bundle (p5-plan.md, D9)', () => {
  it('is made of functions/ and apps/api/src, and both are found', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(3);
  });

  it('imports nothing from the web app, which holds the test server', () => {
    for (const [path, source] of Object.entries(deployed)) {
      expect(source, path).not.toMatch(/from\s+['"][^'"]*(apps\/web|@nekotype\/web)/);
    }
  });

  it('has no test route', () => {
    for (const [path, source] of Object.entries(deployed)) {
      expect(source, path).not.toContain('api/test');
    }
  });
});
