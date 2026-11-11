// Hand-written items for tests only: the app reads the generated chunks in `../content/`.
import type { ContentItem } from './types';

export const wordsFixture: readonly ContentItem[] = [
  // Katakana standard loanwords
  {
    id: 'word:ko-hi-',
    text: 'コーヒー',
    script: 'katakana',
    meaning: { en: 'Coffee' },
  },
  {
    id: 'word:pasokon',
    text: 'パソコン',
    script: 'katakana',
    meaning: { en: 'Personal computer' },
  },
  {
    id: 'word:aisu',
    text: 'アイス',
    script: 'katakana',
    meaning: { en: 'Ice cream' },
  },
  {
    id: 'word:hoteru',
    text: 'ホテル',
    script: 'katakana',
    meaning: { en: 'Hotel' },
  },
  {
    id: 'word:takushi-',
    text: 'タクシー',
    script: 'katakana',
    meaning: { en: 'Taxi' },
  },
  {
    id: 'word:pan',
    text: 'パン',
    script: 'katakana',
    meaning: { en: 'Bread' },
  },
  {
    id: 'word:kamera',
    text: 'カメラ',
    script: 'katakana',
    meaning: { en: 'Camera' },
  },
  {
    id: 'word:terebi',
    text: 'テレビ',
    script: 'katakana',
    meaning: { en: 'Television' },
  },
  {
    id: 'word:basu',
    text: 'バス',
    script: 'katakana',
    meaning: { en: 'Bus' },
  },
  {
    id: 'word:sumaho',
    text: 'スマホ',
    script: 'katakana',
    meaning: { en: 'Smartphone' },
  },
  {
    id: 'word:tesuto',
    text: 'テスト',
    script: 'katakana',
    meaning: { en: 'Test / Exam' },
  },
  {
    id: 'word:ke-ki',
    text: 'ケーキ',
    script: 'katakana',
    meaning: { en: 'Cake' },
  },
  {
    id: 'word:no-to',
    text: 'ノート',
    script: 'katakana',
    meaning: { en: 'Notebook' },
  },
  {
    id: 'word:pen',
    text: 'ペン',
    script: 'katakana',
    meaning: { en: 'Pen' },
  },
  {
    id: 'word:toire',
    text: 'トイレ',
    script: 'katakana',
    meaning: { en: 'Restroom' },
  },

  // Katakana extended loanwords
  {
    id: 'word:pa-thi-',
    text: 'パーティー',
    script: 'katakana',
    meaning: { en: 'Party' },
  },
  {
    id: 'word:fairu',
    text: 'ファイル',
    script: 'katakana',
    meaning: { en: 'File' },
  },
  {
    id: 'word:fo-ku',
    text: 'フォーク',
    script: 'katakana',
    meaning: { en: 'Fork' },
  },
  {
    id: 'word:vaiorin',
    text: 'ヴァイオリン',
    script: 'katakana',
    meaning: { en: 'Violin' },
  },
  {
    id: 'word:windou',
    text: 'ウィンドウ',
    script: 'katakana',
    meaning: { en: 'Window' },
  },
  {
    id: 'word:disuku',
    text: 'ディスク',
    script: 'katakana',
    meaning: { en: 'Disk' },
  },
  {
    id: 'word:chekku',
    text: 'チェック',
    script: 'katakana',
    meaning: { en: 'Check' },
  },
  {
    id: 'word:thisshu',
    text: 'ティッシュ',
    script: 'katakana',
    meaning: { en: 'Tissue' },
  },
  {
    id: 'word:kafe',
    text: 'カフェ',
    script: 'katakana',
    meaning: { en: 'Cafe' },
  },
  {
    id: 'word:shefu',
    text: 'シェフ',
    script: 'katakana',
    meaning: { en: 'Chef' },
  },

  // Hiragana words
  {
    id: 'word:arigatou',
    text: 'ありがとう',
    script: 'hiragana',
    meaning: { en: 'Thank you' },
  },
  {
    id: 'word:konnichiha',
    text: 'こんにちは',
    script: 'hiragana',
    meaning: { en: 'Hello / Good afternoon' },
    // こんにちは token indices: こ(0), ん(1), に(2), ち(3), は(4) -> learner は accepts 'wa'
    readingHints: [{ tokenIndex: 4, learner: ['wa'] }],
  },
  {
    id: 'word:sayounara',
    text: 'さようなら',
    script: 'hiragana',
    meaning: { en: 'Goodbye' },
  },
  {
    id: 'word:neko',
    text: 'ねこ',
    script: 'hiragana',
    meaning: { en: 'Cat' },
  },
  {
    id: 'word:inu',
    text: 'いぬ',
    script: 'hiragana',
    meaning: { en: 'Dog' },
  },
  {
    id: 'word:mizu',
    text: 'みず',
    script: 'hiragana',
    meaning: { en: 'Water' },
  },
  {
    id: 'word:ocha',
    text: 'おちゃ',
    script: 'hiragana',
    meaning: { en: 'Green tea' },
  },
  {
    id: 'word:sakura',
    text: 'さくら',
    script: 'hiragana',
    meaning: { en: 'Cherry blossom' },
  },
  {
    id: 'word:tomodachi',
    text: 'ともだち',
    script: 'hiragana',
    meaning: { en: 'Friend' },
  },
  {
    id: 'word:chotto',
    text: 'ちょっと',
    script: 'hiragana',
    meaning: { en: 'A little / Wait' },
  },
  {
    id: 'word:ohayou',
    text: 'おはよう',
    script: 'hiragana',
    meaning: { en: 'Good morning' },
  },
  {
    id: 'word:sumimasen',
    text: 'すみません',
    script: 'hiragana',
    meaning: { en: 'Excuse me' },
  },
  {
    id: 'word:kawaii',
    text: 'かわいい',
    script: 'hiragana',
    meaning: { en: 'Cute' },
  },
  {
    id: 'word:sushi',
    text: 'すし',
    script: 'hiragana',
    meaning: { en: 'Sushi' },
  },
  {
    id: 'word:tenki',
    text: 'てんき',
    script: 'hiragana',
    meaning: { en: 'Weather' },
  },

  // Hiragana everyday words: food, nature, emotions, movement
  {
    id: 'word-gen-1',
    text: 'たべもの',
    script: 'hiragana',
    meaning: { en: 'Food' },
  },
  {
    id: 'word-gen-2',
    text: 'のみもの',
    script: 'hiragana',
    meaning: { en: 'Drink' },
  },
  {
    id: 'word-gen-3',
    text: 'くだもの',
    script: 'hiragana',
    meaning: { en: 'Fruit' },
  },
  {
    id: 'word-gen-4',
    text: 'やさい',
    script: 'hiragana',
    meaning: { en: 'Vegetable' },
  },
  {
    id: 'word-gen-5',
    text: 'さかな',
    script: 'hiragana',
    meaning: { en: 'Fish' },
  },
  {
    id: 'word-gen-6',
    text: 'たまご',
    script: 'hiragana',
    meaning: { en: 'Egg' },
  },
  {
    id: 'word-gen-7',
    text: 'おにぎり',
    script: 'hiragana',
    meaning: { en: 'Rice ball' },
  },
  {
    id: 'word-gen-8',
    text: 'そら',
    script: 'hiragana',
    meaning: { en: 'Sky' },
  },
  {
    id: 'word-gen-9',
    text: 'うみ',
    script: 'hiragana',
    meaning: { en: 'Sea' },
  },
  {
    id: 'word-gen-10',
    text: 'やま',
    script: 'hiragana',
    meaning: { en: 'Mountain' },
  },
  {
    id: 'word-gen-11',
    text: 'あめ',
    script: 'hiragana',
    meaning: { en: 'Rain' },
  },
  {
    id: 'word-gen-12',
    text: 'ゆき',
    script: 'hiragana',
    meaning: { en: 'Snow' },
  },
  {
    id: 'word-gen-13',
    text: 'しあわせ',
    script: 'hiragana',
    meaning: { en: 'Happiness' },
  },
  {
    id: 'word-gen-14',
    text: 'かなしい',
    script: 'hiragana',
    meaning: { en: 'Sad' },
  },
  {
    id: 'word-gen-15',
    text: 'うれしい',
    script: 'hiragana',
    meaning: { en: 'Happy / Glad' },
  },
  {
    id: 'word-gen-16',
    text: 'たのしい',
    script: 'hiragana',
    meaning: { en: 'Fun / Enjoyable' },
  },
  {
    id: 'word-gen-17',
    text: 'はしる',
    script: 'hiragana',
    meaning: { en: 'To run' },
  },
  {
    id: 'word-gen-18',
    text: 'あるく',
    script: 'hiragana',
    meaning: { en: 'To walk' },
  },
  {
    id: 'word-gen-19',
    text: 'およぐ',
    script: 'hiragana',
    meaning: { en: 'To swim' },
  },
  {
    id: 'word-gen-20',
    text: 'こんばんは',
    script: 'hiragana',
    meaning: { en: 'Good evening' },
    // こ(0) ん(1) ば(2) ん(3) は(4) -> final は is the greeting particle, read 'wa'
    readingHints: [{ tokenIndex: 4, learner: ['wa'] }],
  },

  // Katakana everyday words: places, food, drink
  {
    id: 'word-gen-21',
    text: 'レストラン',
    script: 'katakana',
    meaning: { en: 'Restaurant' },
  },
  {
    id: 'word-gen-22',
    text: 'エレベーター',
    script: 'katakana',
    meaning: { en: 'Elevator' },
  },
  {
    id: 'word-gen-23',
    text: 'コンビニ',
    script: 'katakana',
    meaning: { en: 'Convenience store' },
  },
  {
    id: 'word-gen-24',
    text: 'スーパー',
    script: 'katakana',
    meaning: { en: 'Supermarket' },
  },
  {
    id: 'word-gen-25',
    text: 'チョコレート',
    script: 'katakana',
    meaning: { en: 'Chocolate' },
  },
  {
    id: 'word-gen-26',
    text: 'ジュース',
    script: 'katakana',
    meaning: { en: 'Juice' },
  },
  {
    id: 'word-gen-27',
    text: 'デザート',
    script: 'katakana',
    meaning: { en: 'Dessert' },
  },
  {
    id: 'word-gen-28',
    text: 'カレー',
    script: 'katakana',
    meaning: { en: 'Curry' },
  },
  {
    id: 'word-gen-29',
    text: 'ラーメン',
    script: 'katakana',
    meaning: { en: 'Ramen' },
  },
  {
    id: 'word-gen-30',
    text: 'シャワー',
    script: 'katakana',
    meaning: { en: 'Shower' },
  },
];

export const phrasesFixture: readonly ContentItem[] = [
  // Hiragana phrases
  {
    id: 'phrase:hajimemashite',
    text: 'はじめまして',
    script: 'hiragana',
    meaning: { en: 'Nice to meet you' },
  },
  {
    id: 'phrase:douzoyoroshiku',
    text: 'どうぞよろしく',
    script: 'hiragana',
    meaning: { en: 'Pleased to meet you' },
  },
  {
    id: 'phrase:genkidesuka',
    text: 'げんきですか',
    script: 'hiragana',
    meaning: { en: 'How are you?' },
  },
  {
    id: 'phrase:itadakimasu',
    text: 'いただきます',
    script: 'hiragana',
    meaning: { en: 'Bon appétit' },
  },
  {
    id: 'phrase:gochisousama',
    text: 'ごちそうさま',
    script: 'hiragana',
    meaning: { en: 'Thanks for the meal' },
  },

  // Katakana phrases
  {
    id: 'phrase:aisuko-hi-',
    text: 'アイスコーヒー',
    script: 'katakana',
    meaning: { en: 'Iced coffee' },
  },
  {
    id: 'phrase:onrainge-mu',
    text: 'オンラインゲーム',
    script: 'katakana',
    meaning: { en: 'Online game' },
  },
  {
    id: 'phrase:furi-ma-ketto',
    text: 'フリーマーケット',
    script: 'katakana',
    meaning: { en: 'Flea market' },
  },
  {
    id: 'phrase:te-mapa-ku',
    text: 'テーマパーク',
    script: 'katakana',
    meaning: { en: 'Theme park' },
  },
  {
    id: 'phrase:suma-tofon',
    text: 'スマートフォン',
    script: 'katakana',
    meaning: { en: 'Smartphone' },
  },

  // Hiragana everyday phrases: introductions, travel, weather, requests
  {
    id: 'phrase-gen-1',
    text: 'わたしはがくせいです',
    script: 'hiragana',
    meaning: { en: 'I am a student' },
    // わ(0) た(1) し(2) は(3) ... -> topic marker は is read 'wa'
    readingHints: [{ tokenIndex: 3, learner: ['wa'] }],
  },
  {
    id: 'phrase-gen-2',
    text: 'これはなんですか',
    script: 'hiragana',
    meaning: { en: 'What is this?' },
    // こ(0) れ(1) は(2) ... -> topic marker は is read 'wa'
    readingHints: [{ tokenIndex: 2, learner: ['wa'] }],
  },
  {
    id: 'phrase-gen-3',
    text: 'がっこうへいきます',
    script: 'hiragana',
    meaning: { en: 'I go to school' },
    // が(0) っこ(1, merged sokuon) う(2) へ(3) ... -> direction particle へ is read 'e'
    readingHints: [{ tokenIndex: 3, learner: ['e'] }],
  },
  {
    id: 'phrase-gen-4',
    text: 'うちへかえります',
    script: 'hiragana',
    meaning: { en: 'I return home' },
    // う(0) ち(1) へ(2) ... -> direction particle へ is read 'e'
    readingHints: [{ tokenIndex: 2, learner: ['e'] }],
  },
  {
    id: 'phrase-gen-5',
    text: 'にほんへいきたいです',
    script: 'hiragana',
    meaning: { en: 'I want to go to Japan' },
    // に(0) ほ(1) ん(2) へ(3) ... -> direction particle へ is read 'e'
    readingHints: [{ tokenIndex: 3, learner: ['e'] }],
  },
  {
    id: 'phrase-gen-6',
    text: 'あしたはあめです',
    script: 'hiragana',
    meaning: { en: 'It will rain tomorrow' },
    // あ(0) し(1) た(2) は(3) ... -> topic marker は is read 'wa'
    readingHints: [{ tokenIndex: 3, learner: ['wa'] }],
  },
  {
    id: 'phrase-gen-7',
    text: 'きょうはいいてんきですね',
    script: 'hiragana',
    meaning: { en: "The weather is nice today, isn't it?" },
    // きょ(0, digraph) う(1) は(2) ... -> topic marker は is read 'wa'
    readingHints: [{ tokenIndex: 2, learner: ['wa'] }],
  },
  {
    id: 'phrase-gen-8',
    text: 'すしがたべたいです',
    script: 'hiragana',
    meaning: { en: 'I want to eat sushi' },
  },
  {
    id: 'phrase-gen-9',
    text: 'おちゃをください',
    script: 'hiragana',
    meaning: { en: 'Tea, please' },
  },
  {
    id: 'phrase-gen-10',
    text: 'ここにすわってください',
    script: 'hiragana',
    meaning: { en: 'Please sit here' },
    // こ(0) こ(1) に(2) す(3) わ(4) って(5, merged sokuon) ...
  },
  {
    id: 'phrase-gen-11',
    text: 'まっすぐいってください',
    script: 'hiragana',
    meaning: { en: 'Please go straight' },
    // ま(0) っす(1) ぐ(2) い(3) って(4) ...
  },
  {
    id: 'phrase-gen-12',
    text: 'ゆっくりやすんでください',
    script: 'hiragana',
    meaning: { en: 'Please take a good rest' },
    // ゆ(0) っく(1) り(2) ...
  },
  {
    id: 'phrase-gen-13',
    text: 'だいじょうぶですか',
    script: 'hiragana',
    meaning: { en: 'Are you okay?' },
    // だ(0) い(1) じょ(2, digraph) う(3) ...
  },
  {
    id: 'phrase-gen-14',
    text: 'いってきます',
    script: 'hiragana',
    meaning: { en: "I'm off / I'll be back" },
    // い(0) って(1, merged sokuon) き(2) ...
  },

  // Katakana phrases: cafe and takeaway orders
  {
    id: 'phrase-gen-15',
    text: 'ホットコーヒー',
    script: 'katakana',
    meaning: { en: 'Hot coffee' },
  },
  {
    id: 'phrase-gen-16',
    text: 'チーズケーキ',
    script: 'katakana',
    meaning: { en: 'Cheesecake' },
  },
  {
    id: 'phrase-gen-17',
    text: 'フライドポテト',
    script: 'katakana',
    meaning: { en: 'French fries' },
  },
  {
    id: 'phrase-gen-18',
    text: 'アイスクリーム',
    script: 'katakana',
    meaning: { en: 'Ice cream' },
  },
  {
    id: 'phrase-gen-19',
    text: 'ミルクティー',
    script: 'katakana',
    meaning: { en: 'Milk tea' },
    // ミ(0) ル(1) ク(2) ティ(3, extended digraph) ー(4)
  },
  {
    id: 'phrase-gen-20',
    text: 'ハンバーガー',
    script: 'katakana',
    meaning: { en: 'Hamburger' },
  },
];
