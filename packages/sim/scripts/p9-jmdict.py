"""The JMdict analysis of part 1 of the P9 research (docs/research/2026-11-27-p9-words-content.md).

Reads the pinned JMdict and JLPT lists of packages/content/.cache (`pnpm --filter
@nekotype/content run fetch`) and the committed word chunk, and writes into OUT_DIR:

- hira-kind.json: each hiragana word of the chunk -> how JMdict spells its N5-N4 entries
  (kana-only, usually kana, kana in some senses, kanji), the most kana-like of them;
- katakana-pool.json: kana-only JMdict entries with a katakana reading that has a priority tag
  (news1, ichi1, spec1, spec2, gai1), onomatopoeia and names left out, in the chunk format;
- katakana-core.json: the same pool restricted to ichi1, spec1 or spec2.

Run: python3 -I packages/sim/scripts/p9-jmdict.py OUT_DIR
Then: PART=jmdict HIRA_KIND=OUT_DIR/hira-kind.json \
      POOL=core=OUT_DIR/katakana-core.json,all=OUT_DIR/katakana-pool.json \
      pnpm --filter @nekotype/sim run p9-words
"""

import csv
import gzip
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CACHE = ROOT / 'packages/content/.cache'
CONTENT = ROOT / 'apps/web/src/entities/prompt/content'
XML_LANG = '{http://www.w3.org/XML/1998/namespace}lang'
PRIORITY = {'news1', 'ichi1', 'spec1', 'spec2', 'gai1'}
CORE = {'ichi1', 'spec1', 'spec2'}
KATAKANA = re.compile(r'^[ァ-ヺー]+$')
KINDS = ['kana-only', 'usually kana', 'kana in some senses', 'kanji']
# ElementTree expands JMdict's entities to their text, so `&uk;` arrives as this phrase.
USUALLY_KANA = 'usually written using kana'


def read_entries():
    entries = {}
    for _, el in ET.iterparse(gzip.open(CACHE / 'JMdict.gz')):
        if el.tag != 'entry':
            continue
        entries[int(el.findtext('ent_seq'))] = {
            'kanji': [k.findtext('keb') for k in el.findall('k_ele')],
            'reads': [(r.findtext('reb'), [p.text for p in r.findall('re_pri')])
                      for r in el.findall('r_ele')],
            'senses': [{
                'misc': [m.text or '' for m in s.findall('misc')],
                'pos': [p.text or '' for p in s.findall('pos')],
                'gloss': [g.text for g in s.findall('gloss') if g.get(XML_LANG, 'eng') == 'eng'],
            } for s in el.findall('sense')],
        }
        el.clear()
    return entries


def kind(entry):
    if not entry['kanji']:
        return 'kana-only'
    senses = entry['senses']
    if senses and any(USUALLY_KANA in m for m in senses[0]['misc']):
        return 'usually kana'
    if any(USUALLY_KANA in m for s in senses for m in s['misc']):
        return 'kana in some senses'
    return 'kanji'


def main(out):
    jlpt = {}
    for level in ('n5', 'n4'):
        with open(CACHE / f'{level}.csv', encoding='utf8') as f:
            for row in csv.DictReader(f):
                jlpt.setdefault(row['kana'], set()).add(int(row['jmdict_seq']))
    entries = read_entries()

    words = json.loads((CONTENT / 'words-hiragana.json').read_text(encoding='utf8'))
    kinds = {}
    for word in words:
        found = [kind(entries[s]) for s in jlpt.get(word['text'], ()) if s in entries]
        kinds[word['text']] = min(found, key=KINDS.index) if found else 'unknown'
    print('hiragana words by spelling:', dict(Counter(kinds.values())))

    pool = {}
    for seq, entry in entries.items():
        if entry['kanji']:
            continue
        misc = [m for s in entry['senses'] for m in s['misc']]
        pos = [p for s in entry['senses'] for p in s['pos']]
        if any('onomatopoeic' in m for m in misc) or any('name' in p for p in pos):
            continue
        for reb, pri in entry['reads']:
            if KATAKANA.match(reb) and set(pri) & PRIORITY and reb not in pool:
                gloss = entry['senses'][0]['gloss'] if entry['senses'] else []
                pool[reb] = {'pri': set(pri), 'item': {
                    'id': f'w:katakana:{reb}', 'text': reb, 'script': 'katakana',
                    'meaning': {'en': '; '.join(gloss[:2])}}}
                break
    every = [p['item'] for _, p in sorted(pool.items())]
    core = [p['item'] for _, p in sorted(pool.items()) if p['pri'] & CORE]
    print('katakana pool:', len(every), 'core:', len(core))

    out.mkdir(parents=True, exist_ok=True)
    dump = lambda name, data: (out / name).write_text(json.dumps(data, ensure_ascii=False))
    dump('hira-kind.json', kinds)
    dump('katakana-pool.json', every)
    dump('katakana-core.json', core)


if __name__ == '__main__':
    main(Path(sys.argv[1]))
