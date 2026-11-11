import type { ContentItem, ContentKind, ScriptMode } from '../model/types';

/** One generated chunk: `<kind>-<variant>.json` in `entities/prompt/content/` (content.md "Output"). */
export type ContentChunk =
  'words-hiragana' | 'words-katakana' | 'phrases-hiragana' | 'phrases-katakana' | 'phrases-mixed';

/** The chunks a (kind, script) selection reads: one for a script, all of the kind for `both`. */
export function chunksFor(kind: ContentKind, script: ScriptMode): readonly ContentChunk[] {
  if (kind === 'words') {
    if (script === 'hiragana') return ['words-hiragana'];
    if (script === 'katakana') return ['words-katakana'];
    return ['words-hiragana', 'words-katakana'];
  }
  if (script === 'hiragana') return ['phrases-hiragana'];
  if (script === 'katakana') return ['phrases-katakana'];
  return ['phrases-hiragana', 'phrases-katakana', 'phrases-mixed'];
}

// One literal import() per file: Vite turns each into a hashed `content-*` chunk.
const importers: Record<ContentChunk, () => Promise<{ readonly default: unknown }>> = {
  'words-hiragana': () => import('../content/words-hiragana.json'),
  'words-katakana': () => import('../content/words-katakana.json'),
  'phrases-hiragana': () => import('../content/phrases-hiragana.json'),
  'phrases-katakana': () => import('../content/phrases-katakana.json'),
  'phrases-mixed': () => import('../content/phrases-mixed.json'),
};

function isContentItem(value: unknown): value is ContentItem {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'text' in value &&
    typeof value.text === 'string' &&
    'script' in value &&
    (value.script === 'hiragana' || value.script === 'katakana' || value.script === 'mixed') &&
    'meaning' in value &&
    typeof value.meaning === 'object' &&
    value.meaning !== null &&
    'en' in value.meaning &&
    typeof value.meaning.en === 'string'
  );
}

export async function loadChunk(chunk: ContentChunk): Promise<readonly ContentItem[]> {
  const { default: data } = await importers[chunk]();
  if (!Array.isArray(data) || !data.every(isContentItem)) {
    throw new Error(`Content chunk ${chunk} is malformed`);
  }
  return data;
}

/** Loads every chunk of the selection; fails if one fails. */
export async function loadContent(
  kind: ContentKind,
  script: ScriptMode,
): Promise<readonly ContentItem[]> {
  const parts = await Promise.all(chunksFor(kind, script).map(loadChunk));
  return parts.flat();
}
