import type { KanaRow } from '../types';
import { rowsOf } from './notation';

// See notation.ts for how an entry is written.
export const basicRows: readonly KanaRow[] = rowsOf('basic', [
  ['vowels', 'あア a|いイ i|うウ u|えエ e|おオ o'],
  ['k', 'かカ ka|きキ ki|くク ku|けケ ke|こコ ko'],
  ['s', 'さサ sa|しシ shi,si|すス su|せセ se|そソ so'],
  ['t', 'たタ ta|ちチ chi,ti|つツ tsu,tu|てテ te|とト to'],
  ['n', 'なナ na|にニ ni|ぬヌ nu|ねネ ne|のノ no'],
  ['h', 'はハ ha|ひヒ hi|ふフ fu,hu|へヘ he|ほホ ho'],
  ['m', 'まマ ma|みミ mi|むム mu|めメ me|もモ mo'],
  ['y', 'やヤ ya|ゆユ yu|よヨ yo'],
  ['r', 'らラ ra|りリ ri|るル ru|れレ re|ろロ ro'],
  ['w_n', "わワ wa|をヲ wo/o|んン nn,n'/n", 'Wa - Wo - N'],
]);
