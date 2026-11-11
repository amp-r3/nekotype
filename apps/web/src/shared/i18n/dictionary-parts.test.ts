import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { typeEn } from './parts/type/en';
import { statsEn } from './parts/stats/en';
import { settingsEn } from './parts/settings/en';
import { aboutEn } from './parts/about/en';

// A part of the dictionary is loaded with its route (`app/routes.tsx`), so only that screen may use
// its keys: anywhere else they would show as raw keys until the screen had been opened once.
const SRC = join(import.meta.dirname, '..', '..');

const PARTS: readonly (readonly [string, Record<string, string>, RegExp])[] = [
  ['type', typeEn, /^(pages\/trainer|features\/training)\//],
  ['stats', statsEn, /^pages\/stats\//],
  ['settings', settingsEn, /^pages\/settings\//],
  ['about', aboutEn, /^pages\/about\//],
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = sources(SRC)
  .map((path) => ({ path: relative(SRC, path), text: readFileSync(path, 'utf-8') }))
  .filter((file) => !file.path.startsWith('shared/i18n/'));

describe('dictionary parts: a key of a screen part is used only by that screen', () => {
  it.each(PARTS)('%s', (_name, part, owner) => {
    const strays = Object.keys(part).flatMap((key) => {
      // Plural keys are passed without the form (`stats.learn.days`).
      const base = key.replace(/\.(one|few|many|other)$/, '');
      return files
        .filter((file) => file.text.includes(`'${key}'`) || file.text.includes(`'${base}'`))
        .filter((file) => !owner.test(file.path))
        .map((file) => `${key} in ${file.path}`);
    });
    expect(strays).toEqual([]);
  });

  it('reads the sources of every screen', () => {
    expect(files.some((file) => file.path === 'pages/trainer/ui/test-stage.tsx')).toBe(true);
    expect(files.some((file) => file.path === 'pages/learn/ui/learn-page.tsx')).toBe(true);
  });

  it('a dynamic key is built only from core prefixes or inside its screen', () => {
    const dynamic = files.flatMap((file) =>
      [...file.text.matchAll(/\bt(?:Parts|Plural|PluralParts)?\(`([a-zA-Z]+)\./g)].map((match) => ({
        path: file.path,
        prefix: match[1] ?? '',
      })),
    );
    const strays = dynamic.filter(({ path, prefix }) =>
      PARTS.some(
        ([, part, owner]) =>
          Object.keys(part).some((key) => key.startsWith(`${prefix}.`)) && !owner.test(path),
      ),
    );
    expect(strays).toEqual([]);
  });
});
