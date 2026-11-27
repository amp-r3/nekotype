"""The JMdict analysis of part 1 of the P9 research (docs/research/2026-11-27-p9-words-content.md).

Reads the pinned JMdict and JLPT lists of packages/content/.cache (`pnpm --filter
@nekotype/content run fetch`) and the committed word chunk, and writes into OUT_DIR:

- hira-kind.json: each hiragana word of the chunk -> how JMdict spells its N5-N4 entries
  (kana-only, usually kana, kana in some senses, kanji), the most kana-like of them;
- katakana-pool.json: kana-only JMdict entries with a katakana reading that has a priority tag
  (news1, ichi1, spec1, spec2, gai1), onomatopoeia and names left out, in the chunk format;
- katakana-core.json: the same pool restricted to ichi1, spec1 or spec2;
- katakana-kana.json and hiragana-kana.json: the selection the note proposes for both scripts
  (words written in kana, see `proposed`), in the chunk format.

Run: python3 -I packages/sim/scripts/p9-jmdict.py OUT_DIR
Then: PART=jmdict HIRA_KIND=OUT_DIR/hira-kind.json \
      POOL=core=OUT_DIR/katakana-core.json,all=OUT_DIR/katakana-pool.json,kana=OUT_DIR/katakana-kana.json,kana=OUT_DIR/hiragana-kana.json \
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
HIRAGANA = re.compile(r'^[\u3041-\u3096ー]+$')
# The proposed rule: priority tags of general frequency (gai1 is loanwords only, kept for katakana).
PROPOSED_PRIORITY = {'hiragana': {'news1', 'ichi1', 'spec1', 'spec2'},
                     'katakana': {'ichi1', 'spec1', 'spec2'}}
# A sense with one of these `misc` tags is left out; an entry with one on any sense is left out
# when the tag is in UNFIT_ANYWHERE. ElementTree expands the entities to their text.
UNFIT_ANYWHERE = ('vulgar', 'rude or X-rated', 'derogatory', 'sensitive')
UNFIT_FIRST = ('archaic', 'obsolete', 'rare term', 'dated term', 'historical term')
# Parts of speech that make an entry grammar rather than a word to read.
GRAMMAR = ('particle', 'auxiliary', 'conjunction', 'copula', 'prefix', 'suffix', 'counter',
           'expressions')
MEANING_SENSES = 3
MEANING_LIMIT = 60
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


def meaning(entry):
    """The pipeline's rule (content.md, Words, step 4), without `stagr`."""
    glosses = [s['gloss'][0] for s in entry['senses'] if s['gloss']][:MEANING_SENSES]
    while len(glosses) > 1 and len('; '.join(glosses)) > MEANING_LIMIT:
        glosses.pop()
    return '; '.join(glosses)


def proposed(entries, script):
    """Common words written in kana (the note's proposal): kana-only or `uk` on the first sense,
    a reading of the script with a priority tag, no unfit tag, no name, not grammar."""
    pattern = HIRAGANA if script == 'hiragana' else KATAKANA
    words, dropped = {}, Counter()
    for entry in entries.values():
        k = kind(entry)
        if k not in ('kana-only', 'usually kana') or not entry['senses']:
            continue
        reading = next((reb for reb, pri in entry['reads']
                        if pattern.match(reb) and set(pri) & PROPOSED_PRIORITY[script]), None)
        if reading is None or reading in words:
            continue
        misc = [m for s in entry['senses'] for m in s['misc']]
        first = entry['senses'][0]
        if any(tag in m for m in misc for tag in UNFIT_ANYWHERE):
            dropped['unfit'] += 1
            continue
        if any(tag in m for m in first['misc'] for tag in UNFIT_FIRST):
            dropped['archaic or rare'] += 1
            continue
        if any('name' in p for p in first['pos']):
            dropped['name'] += 1
            continue
        if first['pos'] and all(any(g in p for g in GRAMMAR) for p in first['pos']):
            dropped['grammar'] += 1
            continue
        if not first['gloss']:
            dropped['no English'] += 1
            continue
        onomatopoeia = any('onomatopoeic' in m for m in first['misc'])
        words[reading] = {'id': f'w:{script}:{reading}', 'text': reading, 'script': script,
                          'meaning': {'en': meaning(entry)}, 'onomatopoeia': onomatopoeia}
    return [words[r] for r in sorted(words)], dropped


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
    for script in ('hiragana', 'katakana'):
        words, dropped = proposed(entries, script)
        n5n4 = sum(1 for w in words if w['text'] in jlpt)
        sound = sum(1 for w in words if w['onomatopoeia'])
        print(f'{script} proposed: {len(words)} (in N5-N4: {n5n4}, onomatopoeia: {sound}); '
              f'left out: {dict(dropped)}')
        dump(f'{script}-kana.json', [{k: w[k] for k in ('id', 'text', 'script', 'meaning')}
                                      for w in words])


if __name__ == '__main__':
    main(Path(sys.argv[1]))
