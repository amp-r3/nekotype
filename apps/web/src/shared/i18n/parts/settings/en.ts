// The strings of the settings screen (`/settings`): a chunk of their own, loaded with the screen.
export const settingsEn = {
  'settings.reset.description':
    'Erases learning progress and typing statistics stored in this browser.',

  'settings.learn.title': 'Learning',
  'settings.learn.strictness': 'learning strictness',
  'settings.learn.strictnessHint': 'Relaxed also accepts «si» for し and «tu» for つ.',
  'settings.learn.relaxed': 'relaxed',
  'settings.learn.strictIme': 'strict IME',
  'settings.learn.target': 'target answer time',
  'settings.learn.targetHint':
    'With a lower target, kana become confident later, and kana already confident may stop being so.',
  'settings.learn.targetValue': '{ms} ms',
  'settings.typing.title': 'Typing',
  'settings.showTranslation': 'show the translation under the text',
  'settings.showTranslationHint':
    'A line under the typing text with the word or phrase translation.',
  'settings.data.title': 'Data',
  'settings.data.reset': 'reset progress',
  'settings.data.resetAction': 'reset',

  'dialog.close': 'close',
  'reset.title': 'Reset progress?',
  'reset.confirm':
    'Learning progress and typing statistics in this browser will be erased. This cannot be undone.',
  'reset.action': 'reset',
  'reset.cancel': 'cancel',
} as const satisfies Record<string, string>;
