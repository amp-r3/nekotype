// Checks the Markdown files of the repository (docs/README.md, "Conventions").
// Fails on a relative link whose file or `#anchor` does not exist. Reports, without failing,
// files over the size rule and paragraphs long enough to be split into a list.
// External URLs are not fetched. `docs/design/source/` is a verbatim export and is skipped.
// Usage: node scripts/check-docs.mjs [file.md …]; with no arguments, every tracked Markdown file.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIPPED = ['docs/design/source/'];
// Not held to the size rule: history, and the working plan of a phase (`p5-plan.md`), which moves to
// `docs/archive/` when the phase ends.
const UNMAINTAINED = ['docs/archive/', 'docs/adr/', /^p\d+-plan\.md$/];
const MAX_FILE_BYTES = 20 * 1024;
const MAX_PARAGRAPH_CHARS = 1000;

const listed = process.argv.slice(2).filter((file) => file.endsWith('.md'));
const files = (
  listed.length > 0
    ? listed
    : execFileSync('git', ['ls-files', '*.md'], { cwd: ROOT, encoding: 'utf8' }).split('\n')
).filter((file) => file !== '' && !SKIPPED.some((dir) => file.startsWith(dir)));

/** Text outside fenced code blocks, line by line; inline code is emptied unless kept. */
function proseLines(text, keepInlineCode = false) {
  let fence = null;
  return text.split('\n').map((line) => {
    const opener = /^\s*(`{3,}|~{3,})/.exec(line);
    if (opener) {
      const mark = opener[1];
      if (fence === null) fence = mark;
      else if (mark.startsWith(fence)) fence = null;
      return '';
    }
    if (fence !== null) return '';
    return keepInlineCode ? line : line.replace(/`[^`]*`/g, '``');
  });
}

/** GitHub's heading anchors: lower case, punctuation removed, spaces as hyphens, repeats numbered. */
function anchorsOf(text) {
  const anchors = new Set();
  const seen = new Map();
  for (const line of proseLines(text, true)) {
    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!heading) continue;
    const title = heading[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    const base = title
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
      .replace(/ /g, '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

const anchorCache = new Map();
function anchorsOfFile(path) {
  let anchors = anchorCache.get(path);
  if (anchors === undefined) {
    anchors = anchorsOf(readFileSync(path, 'utf8'));
    anchorCache.set(path, anchors);
  }
  return anchors;
}

const errors = [];
const warnings = [];

for (const file of files) {
  const path = join(ROOT, file);
  const text = readFileSync(path, 'utf8');
  const lines = proseLines(text);

  lines.forEach((line, index) => {
    for (const match of line.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      const target = match[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const [pathPart, anchor] = target.split('#');
      const resolved = pathPart === '' ? path : normalize(join(dirname(path), decodeURI(pathPart)));
      const where = `${file}:${index + 1}`;
      if (!existsSync(resolved)) {
        errors.push(`${where}: ${target}: no such file`);
        continue;
      }
      if (anchor === undefined || anchor === '' || !resolved.endsWith('.md')) continue;
      if (statSync(resolved).isDirectory()) continue;
      if (!anchorsOfFile(resolved).has(decodeURIComponent(anchor).toLowerCase())) {
        errors.push(
          `${where}: ${target}: no heading for #${anchor} in ${relative(ROOT, resolved)}`,
        );
      }
    }
  });

  if (
    UNMAINTAINED.some((rule) =>
      typeof rule === 'string' ? file.startsWith(rule) : rule.test(file),
    )
  )
    continue;
  const bytes = Buffer.byteLength(text);
  if (bytes > MAX_FILE_BYTES) {
    warnings.push(`${file}: ${(bytes / 1024).toFixed(1)} KB, over ${MAX_FILE_BYTES / 1024} KB`);
  }
  lines.forEach((line, index) => {
    if (line.trimStart().startsWith('|')) return;
    if (line.length > MAX_PARAGRAPH_CHARS) {
      warnings.push(`${file}:${index + 1}: a paragraph of ${line.length} characters`);
    }
  });
}

if (warnings.length > 0) {
  console.log(`check-docs: ${warnings.length} to split (docs/README.md, "Conventions"):`);
  for (const warning of warnings) console.log(`  ${warning}`);
}
if (errors.length > 0) {
  console.error(`check-docs: ${errors.length} broken links:`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}
console.log(`check-docs: ${files.length} files, links OK`);
