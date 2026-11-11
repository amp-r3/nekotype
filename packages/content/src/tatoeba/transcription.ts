/**
 * Parses a Tatoeba transcription (`jpn_transcriptions.tsv`, field `transcription`) into plain
 * kana. The text is kana and punctuation with furigana groups `[kanji|reading]` or
 * `[kanji|r1|r2|…]`; the readings after the first `|` are per-kanji parts and are concatenated.
 * Anything else (unbalanced brackets, an empty reading, a `|` outside a group) is unreadable.
 */
export function parseTranscription(text: string): { reading: string } | null {
  let reading = '';
  let group: string | null = null;
  for (const ch of text) {
    if (group === null) {
      if (ch === '[') group = '';
      else if (ch === ']' || ch === '|') return null;
      else reading += ch;
    } else if (ch === ']') {
      const parts = group.split('|');
      const readings = parts.slice(1);
      if (parts[0] === '' || readings.length === 0 || readings.some((part) => part === '')) {
        return null;
      }
      reading += readings.join('');
      group = null;
    } else if (ch === '[') {
      return null;
    } else {
      group += ch;
    }
  }
  return group === null ? { reading } : null;
}
