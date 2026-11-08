import { effect } from '@preact/signals';
import { LocalStorageStore, databaseMode, getDatabase, removeLegacyKeys } from '@/shared/lib';
import { initLocale, locale, t } from '@/shared/i18n';
import { currentPath } from '@/shared/lib';
import { initSettings, flushSettings } from '@/entities/settings';
import { initProgress, flushProgress } from '@/entities/stats';

// The tab title follows the screen; `t()` reads the language, so it follows that too.
function routeTitle(path: string): string {
  switch (path) {
    case '/learn':
      return `${t('page.learn')} — ${t('app.title')}`;
    case '/stats':
      return `${t('page.stats')} — ${t('app.title')}`;
    case '/settings':
      return `${t('page.settings')} — ${t('app.title')}`;
    case '/about':
      return `${t('page.about')} — ${t('app.title')}`;
    default:
      return t('app.title');
  }
}

/** Resolves when the interface language is ready: render only then, so no string flashes in English. */
export function initApp(): Promise<void> {
  const store = new LocalStorageStore();
  const localeReady = initLocale(store);
  initSettings(store);
  initProgress(store);

  // Opens the database (and resets it if the schema changed). The shell does not wait for it.
  void getDatabase().then(() => {
    if (databaseMode.value === 'indexeddb') {
      removeLegacyKeys(store);
    }
  });

  // Sync documentElement.lang with active locale signal
  if (typeof document !== 'undefined') {
    effect(() => {
      document.documentElement.lang = locale.value;
    });

    effect(() => {
      document.title = routeTitle(currentPath.value);
    });
  }

  // Flush persistence on pagehide and visibilitychange (Plan 3.2 Rule 4 & Section 8)
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
      flushSettings();
      flushProgress();
    });

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushSettings();
        flushProgress();
      }
    });
  }

  return localeReady;
}
