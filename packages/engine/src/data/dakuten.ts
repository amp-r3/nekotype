import type { KanaRow } from '../types';
import { rowsOf } from './notation';

// See notation.ts for how an entry is written.
export const dakutenRows: readonly KanaRow[] = rowsOf('dakuten', [
  ['g', 'がガ ga|ぎギ gi|ぐグ gu|げゲ ge|ごゴ go'],
  ['z', 'ざザ za|じジ ji,zi|ずズ zu|ぜゼ ze|ぞゾ zo'],
  ['d', 'だダ da|ぢヂ di/ji,zi,dzi|づヅ du/zu,dzu|でデ de|どド do'],
  ['b', 'ばバ ba|びビ bi|ぶブ bu|べベ be|ぼボ bo'],
  ['p', 'ぱパ pa|ぴピ pi|ぷプ pu|ぺペ pe|ぽポ po'],
]);
