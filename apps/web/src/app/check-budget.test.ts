import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  checkBudget,
  PROBE_MARKER,
  SIGNALS_MARKER,
  MODEL_CHUNK,
  SYNC_ENTRY,
  DETAILS_ENTRY,
} from '../../scripts/check-budget.mjs';

// Random bytes do not compress, so a file of N KB is about N KB raw, gzip and brotli.
const KB = 1024;
const blob = (kb: number): Buffer => randomBytes(Math.round(kb * KB));

type ManifestChunk = {
  file: string;
  name?: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  css?: string[];
  assets?: string[];
};

type Fixture = {
  htmlKb?: number;
  jsKb?: number;
  cssKb?: number;
  fontsKb?: number[];
  svgKb?: number;
  sharedJsKb?: number;
  lazy?: { src: string; kb: number }[];
  manifest?: boolean;
  // The font preload in index.html: right (default), absent, naming a missing file, or without
  // crossorigin.
  preload?: 'ok' | 'absent' | 'dangling' | 'no-crossorigin';
  // Put the latency probe's global into the bundle, as a test build would.
  probe?: boolean;
  // Leave out the Preact integration of @preact/signals, as a wrong `sideEffects` would.
  signals?: boolean;
  // A dynamic import whose code was folded into the initial chunk.
  lazyInInitial?: boolean;
  // Where the sync engine's chunk (`features/sync`) is: a chunk of its own that only the account
  // panel imports (default), folded into the initial chunk, a static import of a route chunk, or
  // missing from the manifest.
  sync?: 'lazy' | 'initial' | 'route' | 'absent';
  // Where the kana details dialog's chunk is: a chunk of its own that only the host imports
  // (default), folded into the initial chunk, a static import of a route chunk, or missing from the
  // manifest.
  details?: 'lazy' | 'initial' | 'route' | 'absent';
  // Where the model's chunk (named `model`) is: shared by lazy chunks (default), folded into the
  // initial chunk, a static import of a route chunk, or missing from the manifest.
  model?: 'lazy' | 'initial' | 'route' | 'absent';
};

const dirs: string[] = [];

function write(root: string, rel: string, data: Buffer | string): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

/** Builds a dist directory with a Vite manifest of the given sizes. */
function makeDist(f: Fixture): string {
  const root = mkdtempSync(join(tmpdir(), 'nekotype-budget-'));
  dirs.push(root);
  const manifest: Record<string, ManifestChunk> = {};
  const fonts = (f.fontsKb ?? [10, 10]).map((size, i) => ({ file: `assets/font${i}.woff2`, size }));

  const preload = f.preload ?? 'ok';
  const kanaFont = 'assets/NotoSansJP-400-test.woff2';
  const tag =
    preload === 'absent'
      ? ''
      : `<link rel="preload" as="font" type="font/woff2" href="/${
          preload === 'dangling' ? 'assets/NotoSansJP-400-gone.woff2' : kanaFont
        }"${preload === 'no-crossorigin' ? '' : ' crossorigin'} />`;
  // The padding is random, so the HTML is about `htmlKb` after gzip as well.
  const padding = blob(f.htmlKb ?? 0.3).toString('base64');
  write(root, 'index.html', `<!doctype html><head>${tag}</head><!-- ${padding} -->`);
  write(root, kanaFont, blob(10));
  write(
    root,
    'assets/index.js',
    Buffer.concat([
      blob(f.jsKb ?? 10),
      Buffer.from(f.signals === false ? '' : `;const ${SIGNALS_MARKER}=1;`),
      Buffer.from(f.probe === true ? `;window.${PROBE_MARKER}={};` : ''),
    ]),
  );
  write(root, 'assets/index.css', blob(f.cssKb ?? 3));
  for (const font of fonts) write(root, font.file, blob(font.size));

  const entry: ManifestChunk = {
    file: 'assets/index.js',
    src: 'index.html',
    isEntry: true,
    css: ['assets/index.css'],
    assets: fonts.map((font) => font.file),
  };
  if (f.svgKb !== undefined) {
    write(root, 'assets/logo.svg', blob(f.svgKb));
    entry.assets = [...(entry.assets ?? []), 'assets/logo.svg'];
  }
  manifest['index.html'] = entry;

  if (f.sharedJsKb !== undefined) {
    write(root, 'assets/shared.js', blob(f.sharedJsKb));
    manifest['_shared.js'] = { file: 'assets/shared.js' };
    entry.imports = ['_shared.js'];
  }
  for (const [i, lazy] of (f.lazy ?? []).entries()) {
    write(root, `assets/lazy${i}.js`, blob(lazy.kb));
    manifest[lazy.src] = { file: `assets/lazy${i}.js`, src: lazy.src, isDynamicEntry: true };
  }
  if (f.lazyInInitial === true) {
    manifest['src/pages/progress/index.ts'] = {
      file: 'assets/index.js',
      src: 'src/pages/progress/index.ts',
      isDynamicEntry: true,
    };
  }
  const sync = f.sync ?? 'lazy';
  if (sync !== 'absent') {
    write(root, 'assets/sync.js', blob(2));
    manifest[SYNC_ENTRY] = {
      file: sync === 'initial' ? 'assets/index.js' : 'assets/sync.js',
      src: SYNC_ENTRY,
      isDynamicEntry: sync !== 'initial',
    };
    write(root, 'assets/panel.js', blob(1));
    manifest['src/pages/settings/ui/account-panel.tsx'] = {
      file: 'assets/panel.js',
      src: 'src/pages/settings/ui/account-panel.tsx',
      isDynamicEntry: true,
      imports: [SYNC_ENTRY],
    };
    write(root, 'assets/settings.js', blob(1));
    manifest['src/pages/settings/index.ts'] = {
      file: 'assets/settings.js',
      src: 'src/pages/settings/index.ts',
      isDynamicEntry: true,
      imports: sync === 'route' ? [SYNC_ENTRY] : [],
    };
  }
  const details = f.details ?? 'lazy';
  if (details !== 'absent') {
    write(root, 'assets/details.js', blob(1));
    manifest[DETAILS_ENTRY] = {
      file: details === 'initial' ? 'assets/index.js' : 'assets/details.js',
      src: DETAILS_ENTRY,
      isDynamicEntry: details !== 'initial',
    };
    if (details === 'route') {
      write(root, 'assets/progress.js', blob(1));
      manifest['src/pages/progress/index.ts'] = {
        file: 'assets/progress.js',
        src: 'src/pages/progress/index.ts',
        isDynamicEntry: true,
        imports: [DETAILS_ENTRY],
      };
    }
  }
  const model = f.model ?? 'lazy';
  if (model !== 'absent') {
    write(root, 'assets/model.js', blob(2));
    manifest['_model.js'] = {
      file: model === 'initial' ? 'assets/index.js' : 'assets/model.js',
      name: MODEL_CHUNK,
      imports: ['index.html'],
    };
    if (model === 'route') {
      write(root, 'assets/learn.js', blob(1));
      manifest['src/pages/learn/index.ts'] = {
        file: 'assets/learn.js',
        src: 'src/pages/learn/index.ts',
        isDynamicEntry: true,
        imports: ['_model.js'],
      };
    }
  }
  if (f.manifest !== false) write(root, '.vite/manifest.json', JSON.stringify(manifest));
  return root;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const failuresFor = (f: Fixture): readonly string[] => checkBudget(makeDist(f)).failures;

describe('check-budget', () => {
  it('passes a build within every budget', () => {
    const { failures, lines } = checkBudget(
      makeDist({
        lazy: [{ src: 'src/pages/progress/index.ts', kb: 20 }],
      }),
    );
    expect(failures).toEqual([]);
    expect(lines.join('\n')).toContain('Total First Load');
  });

  it('reports gzip and brotli for JS and CSS', () => {
    const { lines } = checkBudget(makeDist({}));
    const text = lines.join('\n');
    expect(text).toMatch(/assets\/index\.js: .*\(gzip\), .*\(brotli\)/);
    expect(text).toMatch(/assets\/index\.css: .*\(gzip\), .*\(brotli\)/);
    expect(text).toMatch(/Initial JS \(gzip\).*brotli/);
  });

  it('passes with the kana font preloaded and reports it', () => {
    const { failures, lines } = checkBudget(makeDist({}));
    expect(failures).toEqual([]);
    expect(lines.join('\n')).toContain('[preload] assets/NotoSansJP-400-test.woff2');
  });

  it('fails when the kana font is not preloaded', () => {
    expect(failuresFor({ preload: 'absent' })).toEqual([
      expect.stringContaining('does not preload the kana font'),
    ]);
  });

  it('fails when the preload names a file that is not in dist', () => {
    const failures = failuresFor({ preload: 'dangling' });
    expect(failures.some((f) => f.includes('not in dist'))).toBe(true);
  });

  it('fails when the font preload has no crossorigin', () => {
    expect(failuresFor({ preload: 'no-crossorigin' })).toEqual([
      expect.stringContaining('no crossorigin'),
    ]);
  });

  it('fails when the production build contains the latency probe', () => {
    const failures = failuresFor({ probe: true });
    expect(failures).toEqual([expect.stringContaining('latency probe')]);
    expect(failures[0]).toContain('assets/index.js');
  });

  it('passes a build without the probe', () => {
    expect(failuresFor({ probe: false })).toEqual([]);
  });

  it('fails when the HTML is over 5 KB', () => {
    expect(failuresFor({ htmlKb: 6 })).toEqual([expect.stringContaining('Initial HTML')]);
  });

  it('fails when initial JS is over 35 KB, counting statically imported chunks', () => {
    expect(failuresFor({ jsKb: 36 })).toEqual([expect.stringContaining('Initial JS')]);
    // 20 + 20 KB: each file is under the limit, together they are not
    expect(failuresFor({ jsKb: 20, sharedJsKb: 20 })).toEqual(
      expect.arrayContaining([expect.stringContaining('Initial JS exceeded budget')]),
    );
  });

  it('fails when the initial JS is more than one file', () => {
    expect(failuresFor({ sharedJsKb: 1 })).toEqual([
      expect.stringContaining('Initial JS is 2 files'),
    ]);
  });

  it('fails when the initial JS lacks the Preact integration of signals', () => {
    expect(failuresFor({ signals: false })).toEqual([expect.stringContaining('@preact/signals')]);
  });

  it('fails when a lazily imported module is folded into the initial chunk', () => {
    expect(failuresFor({ lazyInInitial: true })).toEqual([
      expect.stringContaining('src/pages/progress/index.ts is imported lazily'),
    ]);
  });

  it('passes when the sync engine is a chunk that only the account panel imports', () => {
    expect(failuresFor({ sync: 'lazy' })).toEqual([]);
  });

  it('fails when the sync engine is in the initial chunk', () => {
    const failures = failuresFor({ sync: 'initial' });
    expect(failures.some((f) => f.includes('sync engine') && f.includes('initial chunk'))).toBe(
      true,
    );
  });

  it('fails when a route chunk imports the sync engine statically', () => {
    expect(failuresFor({ sync: 'route' })).toEqual([
      expect.stringContaining('static import of the route chunk assets/settings.js'),
    ]);
  });

  it('passes when the kana details are a chunk that only the host imports', () => {
    expect(failuresFor({ details: 'lazy' })).toEqual([]);
  });

  it('fails when the kana details are in the initial chunk', () => {
    const failures = failuresFor({ details: 'initial' });
    expect(
      failures.some((f) => f.includes('kana details dialog') && f.includes('initial chunk')),
    ).toBe(true);
  });

  it('fails when a route chunk imports the kana details statically', () => {
    expect(failuresFor({ details: 'route' })).toEqual([
      'The kana details dialog is a static import of the route chunk assets/progress.js',
    ]);
  });

  it('fails when the kana details are missing from the manifest', () => {
    expect(failuresFor({ details: 'absent' })).toEqual([
      `${DETAILS_ENTRY} is not in the manifest: its lazy loading cannot be checked`,
    ]);
  });

  it('passes when the model is a chunk of its own', () => {
    expect(failuresFor({ model: 'lazy' })).toEqual([]);
  });

  it('fails when the model is in the initial chunk', () => {
    const failures = failuresFor({ model: 'initial' });
    expect(failures.some((f) => f.includes('model') && f.includes('initial chunk'))).toBe(true);
  });

  it('fails when a route chunk imports the model statically', () => {
    expect(failuresFor({ model: 'route' })).toEqual([
      'The model is a static import of the route chunk assets/learn.js',
    ]);
  });

  it('fails when the model is missing from the manifest', () => {
    expect(failuresFor({ model: 'absent' })).toEqual([
      `No chunk named ${MODEL_CHUNK} is in the manifest: its lazy loading cannot be checked`,
    ]);
  });

  it('fails when the sync engine is missing from the manifest', () => {
    expect(failuresFor({ sync: 'absent' })).toEqual([
      expect.stringContaining('lazy loading cannot be checked'),
    ]);
  });

  it('fails when initial CSS is over 10 KB', () => {
    expect(failuresFor({ cssKb: 11 })).toEqual([expect.stringContaining('Initial CSS')]);
  });

  it('fails for a font over 45 KB, using the files in dist', () => {
    expect(failuresFor({ fontsKb: [10, 46] })).toEqual([expect.stringContaining('font1.woff2')]);
  });

  it('counts the SVG of the initial chunk in the first load', () => {
    // 3 x 44 KB of fonts + 24 KB of JS + 3 KB of CSS is under 160 KB; a 6 KB logo is not
    const without = failuresFor({ fontsKb: [44, 44, 44], jsKb: 24 });
    expect(without).toEqual([]);
    const withSvg = failuresFor({ fontsKb: [44, 44, 44], jsKb: 24, svgKb: 6 });
    expect(withSvg).toEqual([expect.stringContaining('Total first load')]);
  });

  it('fails when the total first load is over 160 KB', () => {
    // every part is within its own budget: 3 fonts x 44 + 30 + 3 + 0.3 is about 165 KB
    const failures = failuresFor({ fontsKb: [44, 44, 44], jsKb: 30 });
    expect(failures).toEqual([expect.stringContaining('Total first load')]);
  });

  it('does not count lazy chunks in the initial JS', () => {
    const failures = failuresFor({
      jsKb: 30,
      lazy: [{ src: 'src/pages/progress/index.ts', kb: 24 }],
    });
    expect(failures).toEqual([]);
  });

  it('applies 25 KB to a lazy route chunk', () => {
    const failures = failuresFor({ lazy: [{ src: 'src/pages/progress/index.ts', kb: 26 }] });
    expect(failures).toEqual([expect.stringContaining('Lazy route chunk')]);
  });

  it('fails on any content chunk, found by its source and not by file name (no content before P12)', () => {
    for (const src of [
      'src/entities/prompt/content/words-hiragana.json',
      'src/entities/prompt/content/phrases-mixed.json',
      'content/n5-words.ts',
    ]) {
      expect(failuresFor({ lazy: [{ src, kb: 1 }] }), src).toEqual([
        expect.stringContaining('no content is shipped before P12'),
      ]);
    }
    expect(failuresFor({ lazy: [{ src: 'src/pages/progress/index.ts', kb: 20 }] })).toEqual([]);
  });

  it('a route chunk is not mistaken for content because of its file name', () => {
    // the old check looked for "words" or "phrases" in the file name
    expect(failuresFor({ lazy: [{ src: 'src/pages/wordsmith/index.ts', kb: 30 }] })).toEqual([
      expect.stringContaining('Lazy route chunk'),
    ]);
  });

  it('fails clearly when the Vite manifest is missing', () => {
    expect(failuresFor({ manifest: false })).toEqual([expect.stringContaining('manifest.json')]);
  });

  it('fails clearly when dist does not exist', () => {
    expect(checkBudget(join(tmpdir(), 'nekotype-no-such-dist')).failures).toEqual([
      expect.stringContaining('does not exist'),
    ]);
  });
});
