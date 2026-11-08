export const en = {
  // Top bar
  'app.title': 'Nekotype',
  'app.reset': 'Reset Progress',
  'app.language': 'Interface language',

  // Navigation and routes
  'nav.label': 'Main navigation',
  'nav.test': 'test',
  'nav.learn': 'learn',
  'nav.stats': 'stats',
  'nav.settings': 'settings',
  'nav.about': 'about',
  'page.learn': 'Learn',
  'page.stats': 'Statistics',
  'page.settings': 'Settings',
  'page.about': 'About',
  'page.stub': 'This screen is not built yet.',
  'route.loading': 'Loading...',
  'storage.unavailable':
    'Your data will not be saved: this browser does not let the page store it.',
  'route.loadError': 'Failed to load the page. Check the connection and try again.',
  'route.retry': 'Try again',
  'notFound.title': 'Page not found',
  'notFound.home': 'Back to the trainer',
  'settings.reset.description':
    'Erases the accuracy and reaction-time statistics stored in this browser.',

  'settings.showTranslation': 'Show the translation under the text',

  // Config bar
  'config.script.hiragana': 'Hiragana',
  'config.script.katakana': 'Katakana',
  'config.script.both': 'Both (Mixed)',
  'config.content.words': 'Words',
  'config.content.phrases': 'Phrases',
  'config.strictness.learner': 'Relaxed',
  'config.strictness.ime': 'Strict IME',
  'config.script.label': 'Script selection',
  'config.content.label': 'Content kind',
  'config.strictness.label': 'Romaji strictness',
  'config.test.label': 'Test type',
  'config.seconds.label': 'Time seconds',
  'config.seconds.option': '{n}s',
  'config.prompts.label': 'Count prompts',
  'config.weakFocus': 'Focus Weak Kana',
  'config.test.time': 'Time',
  'config.test.count': 'Count',
  'config.test.zen': 'Zen',

  // Test stage
  'stage.typePlaceholder': 'type romaji...',
  'stage.inputLabel': 'Kana input sink',
  'stage.restartLabel': 'Restart test',
  'stage.restart': 'Restart',
  'stage.liveKpm': 'kpm',
  'stage.clickToFocus': 'Click to focus',
  'stage.turnImeOff': 'Turn off the Japanese IME',
  'stage.switchLayout': 'Switch your keyboard layout to English',
  'key.esc': 'Esc',
  'key.ctrlEnter': 'ctrl + enter',
  'key.cmdEnter': '⌘ + enter',
  'stage.escHint': 'Esc to reveal canonical romaji',
  'key.tabEnter': 'tab → enter',
  'stage.tabHint': 'restart',
  'stage.blur': 'Return to the window to continue',
  'stage.finish': 'Finish',
  'stage.revealed': 'Revealed: {answer}',
  'stage.contentLoading': 'Loading vocabulary...',
  'stage.contentLoadError': 'Failed to load the vocabulary. Kana are practised until it loads.',

  // Results panel
  'results.title': 'Test Results',
  'results.wpm': 'WPM',
  'results.accuracy': 'Accuracy',
  'results.rawWpm': 'Raw WPM',
  'results.kanaPerMin': 'Kana/min',
  'results.time': 'Time',
  'results.completed': 'Prompts',
  'results.mistakes': 'Mistakes',
  'results.streak': 'Best Streak',
  'results.weakest': 'Weakest Kana This Run',
  'results.nextTest': 'Next Test',
  'results.summary':
    'Test complete. Speed: {wpm} WPM, accuracy: {accuracy} percent. Completed {prompts} prompts with {mistakes} mistakes.',
  'results.chartTitle': 'Speed Over Time (WPM)',
  'results.chartLabel': 'Speed over time graph',

  // Dialogs
  'dialog.close': 'Close',
  'reset.title': 'Reset Progress',
  'reset.confirm': 'Are you sure you want to erase all accuracy and time history?',
  'reset.action': 'Reset Everything',
  'reset.cancel': 'Cancel',
} as const satisfies Record<string, string>;

export type TranslationKey = keyof typeof en;
