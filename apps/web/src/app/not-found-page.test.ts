import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { en } from '@/shared/i18n';

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf-8');

const page = read('../../public/404.html');
const cat = read('../shared/ui/cat.tsx');
const tokens = read('../shared/styles/tokens.css');
const ruSource = read('../shared/i18n/ru.ts');

// `ru` is loaded lazily and has no public export, so its strings are read from the source.
const ruString = (key: string): string | undefined =>
  new RegExp(`'${key}': '([^']+)'`).exec(ruSource)?.[1];

// The neutral cat is the `content`/`neutral` branch of Cat: its body, head and eye shapes.
const neutralCat = cat.slice(cat.indexOf("mood === 'content' || mood === 'neutral'"));
const neutralPaths = [...neutralCat.matchAll(/<path\s+d="([^"]+)"/g)]
  .map((match) => match[1])
  .slice(0, 2);

describe('public/404.html: the static twin of the not-found screen (ADR 077)', () => {
  it('carries the strings of the not-found screen in both languages', () => {
    for (const key of ['notFound.title', 'notFound.text', 'notFound.home'] as const) {
      expect(page).toContain(en[key]);
      const russian = ruString(key);
      expect(russian, key).toBeDefined();
      expect(page).toContain(russian);
    }
  });

  it('draws the cat of the not-found screen, shape for shape', () => {
    expect(neutralPaths).toHaveLength(2);
    for (const d of neutralPaths) expect(page).toContain(`d="${d}"`);
    for (const eye of ['cx="41" cy="37" r="3.4"', 'cx="55" cy="37" r="3.4"']) {
      expect(cat).toContain(eye);
      expect(page).toContain(eye);
    }
  });

  it('uses the dark theme colours of the design tokens', () => {
    for (const name of ['bg', 'fur', 'fur-bright', 'fur-dim', 'eye']) {
      const token = new RegExp(`\\[data-theme='dark'\\] \\{[^}]*--${name}: (#[0-9a-f]{6});`).exec(
        tokens,
      );
      expect(token?.[1], `--${name} in tokens.css`).toBeDefined();
      expect(page).toContain(`--${name}: ${token?.[1]};`);
    }
  });

  it('is one response: no external references, no font or script files', () => {
    expect(page).not.toMatch(/https?:\/\//);
    expect(page).not.toMatch(/<script[^>]*\ssrc=/);
    expect(page).not.toMatch(/rel="stylesheet"/);
    expect(page).not.toContain('@font-face');
  });

  it('is marked, so the deployment smoke test can tell it from the old page', () => {
    expect(page).toContain('data-page="not-found"');
  });

  it('stays inside the HTML budget of 5 KB gzip', () => {
    expect(gzipSync(page).length).toBeLessThanOrEqual(5 * 1024);
  });
});
