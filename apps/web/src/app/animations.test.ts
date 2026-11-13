import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// D20: `animate-fadeIn` was used but never defined, so the results panel did not animate. The results
// blocks now rise in turn with `animate-reveal` (D14).
describe('animation classes', () => {
  const srcDir = join(process.cwd(), 'src');
  const css = readFileSync(join(srcDir, 'app/styles/index.css'), 'utf-8');
  const builtIn = new Set(['spin', 'ping', 'pulse', 'bounce', 'none']);

  const used = new Set<string>();
  for (const file of readdirSync(srcDir, { recursive: true, encoding: 'utf-8' })) {
    if (!file.endsWith('.tsx') || file.endsWith('.test.tsx')) continue;
    const source = readFileSync(join(srcDir, file), 'utf-8');
    for (const match of source.matchAll(/animate-([A-Za-z]+)/g)) {
      const name = match[1];
      if (name !== undefined) used.add(name);
    }
  }

  it('finds the animation classes in use', () => {
    expect(used.has('reveal')).toBe(true);
    expect(used.has('fadeIn')).toBe(false);
    // A rejected key flashes the caret now (ADR 031); there is no shake any more.
    expect(used.has('shake')).toBe(false);
  });

  it('every custom animate-* class used in components is defined in the stylesheet', () => {
    for (const name of used) {
      if (builtIn.has(name)) continue;
      expect(css, `.animate-${name}`).toContain(`.animate-${name} {`);
      expect(css, `@keyframes ${name}`).toContain(`@keyframes ${name} {`);
    }
  });

  it('prefers-reduced-motion switches off the reveal', () => {
    const reduced = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(reduced).toContain('.animate-reveal');
    expect(reduced).toContain('.nk-caret.is-idle');
  });
});
