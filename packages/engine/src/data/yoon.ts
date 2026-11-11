import type { KanaRow } from '../types';
import { rowsOf } from './notation';

// See notation.ts for how an entry is written.
export const yoonRows: readonly KanaRow[] = rowsOf('yoon', [
  ['ky', 'きゃキャ kya|きゅキュ kyu|きょキョ kyo'],
  ['sh', 'しゃシャ sha,sya|しゅシュ shu,syu|しょショ sho,syo'],
  ['ch', 'ちゃチャ cha,tya/cya|ちゅチュ chu,tyu/cyu|ちょチョ cho,tyo/cyo'],
  ['ny', 'にゃニャ nya|にゅニュ nyu|にょニョ nyo'],
  ['hy', 'ひゃヒャ hya|ひゅヒュ hyu|ひょヒョ hyo'],
  ['my', 'みゃミャ mya|みゅミュ myu|みょミョ myo'],
  ['ry', 'りゃリャ rya|りゅリュ ryu|りょリョ ryo'],
  ['gy', 'ぎゃギャ gya|ぎゅギュ gyu|ぎょギョ gyo'],
  ['j', 'じゃジャ ja,zya,jya|じゅジュ ju,zyu,jyu|じょジョ jo,zyo,jyo'],
  ['by', 'びゃビャ bya|びゅビュ byu|びょビョ byo'],
  ['py', 'ぴゃピャ pya|ぴゅピュ pyu|ぴょピョ pyo'],
]);
