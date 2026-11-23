import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync, brotliCompressSync } from 'node:zlib';

// Size budgets from docs/spec/quality.md. All sizes are in KB (1024 bytes).
export const BUDGETS = {
  htmlGzipKb: 5,
  initialJsGzipKb: 35,
  initialCssGzipKb: 10,
  fontKb: 45,
  totalFirstLoadKb: 160,
  lazyRouteGzipKb: 25,
};

// A lazy chunk is a content chunk when its source lives under a `content` directory (the generated
// JSON of `entities/prompt/content/`); every other lazy chunk is a route chunk. No content is
// shipped before P12 (ADR 093), so a content chunk in the build is a failure.
const CONTENT_SOURCE = /(^|\/)content\//;

// The global the probe publishes; it appears in no other place of the application.
export const PROBE_MARKER = '__nekotypeProbe';

// A name only @preact/signals' Preact integration carries. That module hooks into Preact when it is
// imported; a `sideEffects` setting that dropped it would leave every signal-driven render dead.
export const SIGNALS_MARKER = 'ReactiveTextNode';

// The sync engine is for signed-in users: its chunk is loaded by a dynamic import that a user key
// guards, never with the first load or with a screen (p5-plan.md, D17).
export const SYNC_ENTRY = 'src/features/sync/index.ts';
// The knowledge model is a chunk of its own, named in `vite.config.ts` (codeSplitting): the learn
// store loads it by a dynamic import and the session runtime shares it. Never with the first load,
// never a static import of a route (P7 plan, D22). A shared chunk has no `src` in the manifest, so
// it is found by name.
export const MODEL_CHUNK = 'model';
const ROUTE_ENTRY = /^src\/pages\/[^/]+\/index\.ts$/;

const kb = (bytes) => bytes / 1024;
const fmt = (bytes) => `${kb(bytes).toFixed(2)} KB`;

function sizes(path) {
  const content = readFileSync(path);
  return {
    raw: content.length,
    gzip: gzipSync(content).length,
    brotli: brotliCompressSync(content).length,
  };
}

function readManifest(distDir) {
  const manifestPath = join(distDir, '.vite', 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  return JSON.parse(readFileSync(manifestPath, 'utf-8'));
}

/**
 * Chunks reachable from an entry through static imports are loaded with the page ("initial");
 * every other chunk in the manifest is loaded lazily (dynamic import).
 */
function splitChunks(manifest) {
  const initial = new Set();
  const visit = (key) => {
    if (initial.has(key) || manifest[key] === undefined) return;
    initial.add(key);
    for (const dep of manifest[key].imports ?? []) visit(dep);
  };
  for (const [key, chunk] of Object.entries(manifest)) {
    if (chunk.isEntry === true) visit(key);
  }

  const lazy = Object.entries(manifest)
    .filter(([key, chunk]) => !initial.has(key) && chunk.file.endsWith('.js'))
    .map(([key, chunk]) => ({ key, file: chunk.file, src: chunk.src ?? key }));
  return { initial, lazy };
}

/** The chunks `key` loads with it: its static imports, transitively, leaving out the initial ones. */
function staticImports(manifest, key, initial) {
  const seen = new Set();
  const visit = (current) => {
    for (const dep of manifest[current]?.imports ?? []) {
      if (seen.has(dep) || initial.has(dep)) continue;
      seen.add(dep);
      visit(dep);
    }
  };
  visit(key);
  return seen;
}

/**
 * Checks the production build in `distDir` against the budgets.
 * Returns the report lines and the list of exceeded budgets; it does not exit or print.
 */
export function checkBudget(distDir) {
  const lines = [];
  const failures = [];
  const log = (text) => lines.push(text);

  if (!existsSync(distDir)) {
    return { lines, failures: [`${distDir} does not exist. Run the build first.`] };
  }
  const manifest = readManifest(distDir);
  if (manifest === null) {
    return {
      lines,
      failures: [
        'dist/.vite/manifest.json is missing. Set build.manifest: true in vite.config.ts.',
      ],
    };
  }

  const { initial, lazy } = splitChunks(manifest);
  const line = (tag, file, s) =>
    log(`[${tag}] ${file}: ${fmt(s.raw)} (raw), ${fmt(s.gzip)} (gzip), ${fmt(s.brotli)} (brotli)`);

  log('--- Chunk Breakdown (Initial vs Lazy) ---');

  // 1. HTML
  const htmlPath = join(distDir, 'index.html');
  const html = existsSync(htmlPath) ? sizes(htmlPath) : { raw: 0, gzip: 0, brotli: 0 };
  line('initial', 'index.html', html);

  // 2. Initial JS and CSS, taken from the chunks the entry loads statically
  let jsGzip = 0;
  let jsBrotli = 0;
  let cssGzip = 0;
  let cssBrotli = 0;
  const cssFiles = new Set();
  const initialFonts = new Set();
  const initialSvgs = new Set();
  for (const key of initial) {
    const chunk = manifest[key];
    if (chunk === undefined) continue;
    if (chunk.file.endsWith('.js')) {
      const s = sizes(join(distDir, chunk.file));
      line('initial', chunk.file, s);
      jsGzip += s.gzip;
      jsBrotli += s.brotli;
    }
    for (const css of chunk.css ?? []) cssFiles.add(css);
    for (const asset of chunk.assets ?? []) {
      if (asset.endsWith('.woff2')) initialFonts.add(asset);
      if (asset.endsWith('.svg')) initialSvgs.add(asset);
    }
  }
  for (const css of cssFiles) {
    const s = sizes(join(distDir, css));
    line('initial', css, s);
    cssGzip += s.gzip;
    cssBrotli += s.brotli;
  }

  // Everything the entry loads statically is one chunk (vite.config.ts, `codeSplitting`).
  const initialJs = [...initial]
    .map((key) => manifest[key]?.file)
    .filter((file) => file !== undefined && file.endsWith('.js'));
  if (initialJs.length !== 1) {
    failures.push(
      `Initial JS is ${initialJs.length} files (${initialJs.join(', ')}); the entry is meant to be one chunk (vite.config.ts, codeSplitting)`,
    );
  }
  if (
    !initialJs.some((file) => readFileSync(join(distDir, file), 'utf-8').includes(SIGNALS_MARKER))
  ) {
    failures.push(
      'The initial JS lacks the Preact integration of @preact/signals: check `sideEffects` in package.json',
    );
  }
  // A dynamic import must stay a chunk of its own, not be folded into the first load.
  for (const [key, chunk] of Object.entries(manifest)) {
    if (chunk.isDynamicEntry === true && initialJs.includes(chunk.file)) {
      failures.push(`${key} is imported lazily but its code is in the initial chunk ${chunk.file}`);
    }
  }

  // The sync engine stays a chunk of its own that no first load and no screen pulls in.
  const syncChunk = manifest[SYNC_ENTRY];
  if (syncChunk === undefined) {
    failures.push(`${SYNC_ENTRY} is not in the manifest: its lazy loading cannot be checked`);
  } else {
    if (initial.has(SYNC_ENTRY) || initialJs.includes(syncChunk.file)) {
      failures.push(
        `The sync engine (${SYNC_ENTRY}) is in the initial chunk: a guest would load it`,
      );
    }
    for (const [key, chunk] of Object.entries(manifest)) {
      if (
        ROUTE_ENTRY.test(chunk.src ?? key) &&
        staticImports(manifest, key, initial).has(SYNC_ENTRY)
      ) {
        failures.push(`The sync engine is a static import of the route chunk ${chunk.file}`);
      }
    }
  }

  // The model stays a chunk of its own that no first load and no route pulls in.
  const modelKeys = Object.keys(manifest).filter((key) => manifest[key]?.name === MODEL_CHUNK);
  if (modelKeys.length === 0) {
    failures.push(
      `No chunk named ${MODEL_CHUNK} is in the manifest: its lazy loading cannot be checked`,
    );
  }
  for (const modelKey of modelKeys) {
    const modelFile = manifest[modelKey]?.file;
    if (initial.has(modelKey) || (modelFile !== undefined && initialJs.includes(modelFile))) {
      failures.push(`The model (${modelKey}) is in the initial chunk: a first visit would load it`);
    }
    for (const [key, chunk] of Object.entries(manifest)) {
      if (
        ROUTE_ENTRY.test(chunk.src ?? key) &&
        staticImports(manifest, key, initial).has(modelKey)
      ) {
        failures.push(`The model is a static import of the route chunk ${chunk.file}`);
      }
    }
  }

  // Images the entry imports and Vite did not inline (the logo) are part of the first load.
  let svgGzip = 0;
  for (const asset of initialSvgs) {
    const s = sizes(join(distDir, asset));
    line('initial', asset, s);
    svgGzip += s.gzip;
  }

  // 3. Fonts: read from dist, not from the sources
  const assetsDir = join(distDir, 'assets');
  const fonts = (existsSync(assetsDir) ? readdirSync(assetsDir) : [])
    .filter((file) => file.endsWith('.woff2'))
    .map((file) => ({ file: `assets/${file}`, raw: statSync(join(assetsDir, file)).size }));
  let firstLoadFontBytes = 0;
  for (const font of fonts) {
    const firstLoad = initialFonts.has(font.file);
    log(`[${firstLoad ? 'font' : 'font, lazy'}] ${font.file}: ${fmt(font.raw)} (woff2)`);
    if (firstLoad) firstLoadFontBytes += font.raw;
  }

  // 4. Lazy chunks
  for (const chunk of lazy) {
    const s = sizes(join(distDir, chunk.file));
    if (CONTENT_SOURCE.test(chunk.src)) {
      line('lazy content', chunk.file, s);
      failures.push(
        `Content chunk ${chunk.file} is in the build: no content is shipped before P12 (ADR 093)`,
      );
      continue;
    }
    line('lazy route', chunk.file, s);
    if (kb(s.gzip) > BUDGETS.lazyRouteGzipKb) {
      failures.push(
        `Lazy route chunk ${chunk.file} exceeded budget (${kb(s.gzip).toFixed(2)} KB > ${BUDGETS.lazyRouteGzipKb} KB gzip)`,
      );
    }
  }

  // 5. The kana font is preloaded. A preload that is missing makes the first frame wait to find
  // out that it needs the font; one that names a file that is not there, or lacks `crossorigin`
  // (a font is fetched in CORS mode, so without it the file is requested twice), is worse.
  if (existsSync(htmlPath)) {
    const markup = readFileSync(htmlPath, 'utf-8');
    const preloads = [...markup.matchAll(/<link\b[^>]*>/g)]
      .map((match) => match[0])
      .filter((tag) => /\brel="preload"/.test(tag) && /\bas="font"/.test(tag));
    const kana = preloads.filter((tag) => /NotoSansJP/.test(tag));
    if (kana.length === 0) {
      failures.push('index.html does not preload the kana font (Noto Sans JP)');
    }
    for (const tag of preloads) {
      const href = /\bhref="([^"]+)"/.exec(tag)?.[1];
      const file = href === undefined ? undefined : href.slice(href.indexOf('assets/'));
      if (file === undefined || !existsSync(join(distDir, file))) {
        failures.push(`The font preload ${href ?? '(no href)'} names a file that is not in dist`);
      } else {
        log(`[preload] ${file}`);
      }
      if (!/\bcrossorigin\b/.test(tag)) {
        failures.push(`The font preload ${href ?? ''} has no crossorigin attribute`);
      }
    }
  }

  // 6. The latency probe belongs to the test build (docs/spec/quality.md). It is behind a build
  // constant and must be gone from what is deployed: it adds a frame callback and a task per key.
  const assetFiles = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
  for (const file of assetFiles.filter((name) => name.endsWith('.js'))) {
    if (readFileSync(join(assetsDir, file), 'utf-8').includes(PROBE_MARKER)) {
      failures.push(
        `assets/${file} contains the latency probe: it must not be in the production build`,
      );
    }
  }

  const totalFirstLoad = html.gzip + jsGzip + cssGzip + svgGzip + firstLoadFontBytes;

  log('\n--- Size Budget Summary ---');
  log(`Initial HTML (gzip):       ${fmt(html.gzip)} / ${BUDGETS.htmlGzipKb} KB limit`);
  log(
    `Initial JS (gzip):         ${fmt(jsGzip)} / ${BUDGETS.initialJsGzipKb} KB limit (brotli ${fmt(jsBrotli)})`,
  );
  log(
    `Initial CSS (gzip):        ${fmt(cssGzip)} / ${BUDGETS.initialCssGzipKb} KB limit (brotli ${fmt(cssBrotli)})`,
  );
  log(
    `First-load fonts (woff2):  ${fmt(firstLoadFontBytes)} (limit ${BUDGETS.fontKb} KB per file)`,
  );
  log(`Total First Load (gzip):   ${fmt(totalFirstLoad)} / ${BUDGETS.totalFirstLoadKb} KB limit`);

  const over = (label, value, limit) => {
    if (value > limit) {
      failures.push(`${label} exceeded budget (${value.toFixed(2)} KB > ${limit} KB)`);
    }
  };
  over('Initial HTML', kb(html.gzip), BUDGETS.htmlGzipKb);
  over('Initial JS', kb(jsGzip), BUDGETS.initialJsGzipKb);
  over('Initial CSS', kb(cssGzip), BUDGETS.initialCssGzipKb);
  for (const font of fonts) over(`Font ${font.file}`, kb(font.raw), BUDGETS.fontKb);
  over('Total first load', kb(totalFirstLoad), BUDGETS.totalFirstLoadKb);

  return { lines, failures };
}

// CLI: node scripts/check-budget.mjs [distDir]
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = process.argv[2] ?? join(process.cwd(), 'dist');
  const { lines, failures } = checkBudget(distDir);
  for (const text of lines) console.log(text);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAILED: ${failure}`);
    process.exit(1);
  }
  console.log('All size budgets passed!');
}
