import type { KanaRow } from '../types';
import { rowsOf } from './notation';

// See notation.ts for how an entry is written.
export const extendedRows: readonly KanaRow[] = rowsOf('extended', [
  ['ext_fa', 'ファ fa/fua,huxa|フィ fi/fui,huxi|フェ fe/fue,huxe|フォ fo/fuo,huxo'],
  ['ext_va', 'ヴァ va/buxa|ヴィ vi/buxi|ヴ vu|ヴェ ve/buxe|ヴォ vo/buxo'],
  ['ext_wi', 'ウィ wi/whi,uxi|ウェ we/whe,uxe|ウォ who/wo,uxo', 'Wi - We - Who (Wo)'],
  [
    'ext_ti',
    'ティ thi/ti,texi|トゥ twu/tu,toxu|ディ dhi/di,dexi|ドゥ dwu/du,doxu|テュ thu/texyu|デュ dhu/dexyu',
  ],
  ['ext_che', 'シェ she/sye,sixe|ジェ je/zye,jye,zixe|チェ che/tye,cye,tixe'],
]);
