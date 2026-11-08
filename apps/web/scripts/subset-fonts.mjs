import { createHash } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';

import { allKanaRows } from '@nekotype/engine';
import { wordsData } from '../src/entities/prompt/model/data/words.ts';
import { phrasesData } from '../src/entities/prompt/model/data/phrases.ts';

// Kana, words and phrases are the Noto subset (glyphs.txt); the other sets are fixed here.
// data.test.ts keeps the mandatory list below in sync with this script.
const mandatoryChars = 'ーっッゃゅょャュョァィゥェォ、。・０１２３４５６７８９';

const range = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)).join('');
const ascii = range(0x20, 0x7e);
const cyrillic = range(0x410, 0x44f) + 'Ёё';
// U+2212 minus, U+00A0 and U+202F: no-break spaces (ADR 034, design decision 20).
const spaces = '\u00a0\u202f';
const minus = '\u2212';
const uiExtras = 'ūōé←→·…—–«»×№' + spaces;

// Sources are pinned to a google/fonts commit and checked against a hash (ADR 034).
const GOOGLE_FONTS_COMMIT = '2fe1e8c6b137fb13041a7cfca6fdcd8a910ea4dc';
const sources = {
  golos: {
    path: 'ofl/golostext/GolosText[wght].ttf',
    sha256: '17bb58fb69aec2dfb047a2ebf52534023e9b688c97a6b7ac795b0a72912c2063',
  },
  mono: {
    path: 'ofl/jetbrainsmono/JetBrainsMono[wght].ttf',
    sha256: '48715a42ec242c21e9f02692891e147d022299a52e48d5e413e1a942193ffeda',
  },
  noto: {
    path: 'ofl/notosansjp/NotoSansJP[wght].ttf',
    sha256: 'c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f',
  },
};

const chars = new Set(mandatoryChars);
for (const row of allKanaRows) {
  for (const entry of row.entries) {
    if (entry.hiragana) for (const ch of entry.hiragana) chars.add(ch);
    for (const ch of entry.katakana) for (const c of ch) chars.add(c);
  }
}
for (const w of wordsData) for (const ch of w.text) chars.add(ch);
for (const p of phrasesData) for (const ch of p.text) chars.add(ch);

const sortedGlyphs = Array.from(chars).sort().join('');
writeFileSync(join(process.cwd(), 'glyphs.txt'), sortedGlyphs, 'utf-8');
console.log(`Updated glyphs.txt (${chars.size} glyphs)`);

const monoGlyphs = ascii + cyrillic + '←→✕' + minus + spaces;

const outputs = [
  {
    source: 'golos',
    file: 'GolosText-400.woff2',
    wght: 400,
    glyphs: ascii + cyrillic + uiExtras + minus,
  },
  { source: 'golos', file: 'GolosText-500.woff2', wght: 500, glyphs: ascii + cyrillic + uiExtras },
  { source: 'mono', file: 'JetBrainsMono-400.woff2', wght: 400, glyphs: monoGlyphs + '·⌘' },
  { source: 'mono', file: 'JetBrainsMono-500.woff2', wght: 500, glyphs: monoGlyphs },
  { source: 'noto', file: 'NotoSansJP-400.woff2', wght: 400, glyphs: sortedGlyphs },
];

const srcDir = join(process.cwd(), 'scripts/font-src');
const outDir = join(process.cwd(), 'src/assets/fonts');
mkdirSync(srcDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function loadSource(key) {
  const { path, sha256: expected } = sources[key];
  const local = join(srcDir, path.split('/').pop());
  let buf = existsSync(local) ? readFileSync(local) : undefined;
  if (!buf) {
    const url = `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS_COMMIT}/${path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Cannot download ${url}: HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(local, buf);
  }
  const actual = sha256(buf);
  if (actual !== expected) {
    throw new Error(`${path}: sha256 ${actual} does not match the pinned ${expected}`);
  }
  return buf;
}

const loaded = {};
for (const out of outputs) {
  loaded[out.source] ??= await loadSource(out.source);
  const woff2 = await subsetFont(loaded[out.source], out.glyphs, {
    targetFormat: 'woff2',
    variationAxes: { wght: out.wght },
    noLayoutClosure: true,
  });
  writeFileSync(join(outDir, out.file), woff2);
  console.log(`Generated ${out.file} (${(woff2.length / 1024).toFixed(2)} KB)`);
}
