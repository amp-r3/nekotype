import { describe, expect, it } from 'vitest';
import { parseTranscription } from './transcription';

// Rows copied from jpn_transcriptions.tsv (retrieved 2026-11-11).
const readable: [id: number, text: string, reading: string][] = [
  [4573111, 'ギター[弾|ひ]けるようになりたい。', 'ギターひけるようになりたい。'],
  [
    4593710,
    'ヨーロッパで[行|い]ってみたい[場所|ば|しょ]とかある？',
    'ヨーロッパでいってみたいばしょとかある？',
  ],
  [
    4738018,
    '[俺|おれ]がトムを[殺|ころ]したって[言|い]うのか？',
    'おれがトムをころしたっていうのか？',
  ],
  [
    4711497,
    '「テストどうだった？」「やばいよ。[0点|れい|てん]かも」「は、まじで？」',
    '「テストどうだった？」「やばいよ。れいてんかも」「は、まじで？」',
  ],
  [
    4720220,
    '「[雨|あめ]やんだかな？」「やんでるといいね」',
    '「あめやんだかな？」「やんでるといいね」',
  ],
  [
    76056,
    '[自分|じ|ぶん]に「できそこない」のレッテルを[貼|は]って',
    'じぶんに「できそこない」のレッテルをはって',
  ],
  [
    4708791,
    '「[Twitter|ツイッター]って[何|なに]が[面白|おも|しろ]いのか」',
    '「ツイッターってなにがおもしろいのか」',
  ],
  [4751774, 'ほんと[金|かね][返|かえ]せって[感|かん]じ', 'ほんとかねかえせってかんじ'],
  [4630426, '「[今日|きょう][何|なん][曜日|よう|び]ですか？」', '「きょうなんようびですか？」'],
  [4715644, '「[自転車|じ|てん|しゃ]の[鍵|かぎ]」', '「じてんしゃのかぎ」'],
  [4737287, 'ごめん、ぼーっとしてた。', 'ごめん、ぼーっとしてた。'],
  [201726, 'トイレはどこですか。', 'トイレはどこですか。'],
];

describe('parseTranscription', () => {
  it.each(readable)('reads row %i', (_id, text, reading) => {
    expect(parseTranscription(text)).toEqual({ reading });
  });

  it('reads an empty text as an empty reading', () => {
    expect(parseTranscription('')).toEqual({ reading: '' });
  });

  it('concatenates the readings after the first |', () => {
    expect(parseTranscription('[場所|ば|しょ]')).toEqual({ reading: 'ばしょ' });
  });

  // Real rows whose group has an empty reading: symbols Tatoeba does not transcribe.
  const emptyReading: [number, string][] = [
    [2769672, '[Wi|ワイ][-|][Fi|ファイ] ってフランス[語|ご]ではどう[発音|はつ|おん]するんですか？'],
    [6832768, '[鍵|かぎ]を[持|も]っているのは[誰|だれ]だ？ [―|] マルコが[持|も]っている。'],
    [1490062, '[肉|にく]を[半|はん][㌔|]ください。'],
  ];
  it.each(emptyReading)('rejects row %i (empty reading)', (_id, text) => {
    expect(parseTranscription(text)).toBeNull();
  });

  it.each([
    ['unclosed bracket', '[俺|おれ'],
    ['stray closing bracket', '俺]がいる'],
    ['nested bracket', '[[俺|おれ]]'],
    ['group without a reading', '[俺]'],
    ['empty base', '[|おれ]'],
    ['| outside a group', 'おれ|だ'],
  ])('rejects %s', (_name, text) => {
    expect(parseTranscription(text)).toBeNull();
  });
});
