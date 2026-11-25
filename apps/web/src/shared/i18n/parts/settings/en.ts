// The strings of the settings screen (`/settings`): a chunk of their own, loaded with the screen.
export const settingsEn = {
  'settings.reset.description': 'Erases learning progress stored in this browser.',

  'settings.learn.title': 'Learning',
  'settings.learn.strictness': 'learning strictness',
  'settings.learn.strictnessHint': 'Relaxed also accepts «si» for し and «tu» for つ.',
  'settings.learn.relaxed': 'relaxed',
  'settings.learn.strictIme': 'strict IME',
  'settings.data.title': 'Data',
  'settings.data.reset': 'reset progress',
  'settings.data.resetAction': 'reset',

  'settings.account.title': 'Account',
  'settings.sync.synced': 'synced',
  'settings.sync.pending': 'pending',
  'settings.sync.offline': 'offline',
  'settings.sync.expired': 'session expired',
  'settings.sync.blocked': 'sync is paused until the next app update',
  'settings.account.guest':
    'You are a guest: progress lives in this browser only. Sign in to sync it across devices.',
  'settings.account.google': 'sign in with Google',
  'settings.account.github': 'sign in with GitHub',
  'settings.account.viaGoogle': 'via Google',
  'settings.account.viaGithub': 'via GitHub',
  'settings.account.noName': 'account',
  'settings.account.sync': 'sync',
  'settings.account.signInAgain': 'sign in again',
  'settings.account.signOut': 'sign out',
  'settings.account.needsConnection': 'Needs a connection.',
  'signOut.title': 'Sign out?',
  'signOut.progress': 'Some progress has not been sent yet. If you sign out now, it will be lost.',
  'signOut.cancel': 'cancel',
  'signOut.action': 'sign out',
  'settings.account.delete': 'delete account',
  'settings.account.signInToDelete': 'Sign in again to delete the account.',
  'delete.title': 'Delete account?',
  'delete.text': 'Your account and learning progress will be deleted on every device.',
  'delete.label': 'Type "delete" to confirm',
  // The word to type; compared without case and surrounding spaces.
  'delete.word': 'delete',
  'delete.cancel': 'cancel',
  'delete.action': 'delete forever',
  'delete.busy': 'deleting…',
  'delete.failed': 'failed to delete. check the connection and try again.',

  // The "another account" dialog of the sync chunk (design decision 118), shown on `/`: it
  // loads this part first.
  'account.other.title': 'Sign in to another account?',
  'account.other.text':
    'This browser holds data of another account that has not been sent. If you continue, it will be lost.',
  'account.other.cancel': 'cancel',
  'account.other.discard': 'discard and continue',

  'dialog.close': 'close',
  'reset.title': 'Reset progress?',
  'reset.confirm': 'Learning progress in this browser will be erased. This cannot be undone.',
  'reset.action': 'reset',
  'reset.cancel': 'cancel',
} as const satisfies Record<string, string>;
