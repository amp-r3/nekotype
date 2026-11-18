import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const routes: unknown = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../public/_routes.json', import.meta.url)), 'utf-8'),
);

describe('_routes.json: only /api/* invokes Functions', () => {
  it('includes /api/* and excludes nothing, so static files cost no Functions request', () => {
    // Functions run on a free quota of 100,000 requests a day (docs/spec/backend.md); a page, a
    // font or a chunk must never count against it.
    expect(routes).toEqual({ version: 1, include: ['/api/*'], exclude: [] });
  });
});
