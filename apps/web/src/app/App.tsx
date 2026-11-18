import type { ComponentType, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { loadDictionaryPart, t } from '@/shared/i18n';
import { cx, currentPath, databaseMode, immersive, navigate } from '@/shared/lib';
import { Footer, Link, Nav } from '@/shared/ui';
import { authAvailable, sessionExpired, signInCheck, userId } from '@/entities/user';
import lockupUrl from '@/assets/logo/lockup.svg';
import { LangSwitch } from './lang-switch';
import { RouteView } from './route-view';

// `sign in` for a guest, `sign in again` while the session is expired, nothing after sign-in or on a
// preview (design decisions 65, 120). Both lead to `/settings`.
function SignInLink(): JSX.Element | null {
  if (!authAvailable.value) return null;
  const expired = sessionExpired.value;
  if (userId.value !== null && !expired) return null;
  return (
    <Link
      href="/settings"
      onNavigate={navigate}
      className="text-ui-label pointer-coarse:min-h-touch-min text-fur-dim hover:text-fur inline-flex items-center rounded-xs whitespace-nowrap transition-colors"
    >
      {t(expired ? 'nav.signInAgain' : 'nav.signIn')}
    </Link>
  );
}

// The dialog of a sign-in that returned as another account with unsent data (design decision 118):
// it lives in the sync chunk, which is already loaded when it is wanted.
function AnotherAccount(): JSX.Element | null {
  const open = signInCheck.value === 'choice';
  const [View, setView] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (!open || View !== null) return;
    // Its strings are in the settings part of the dictionary.
    void Promise.all([import('@/features/sync'), loadDictionaryPart('settings')]).then(([m]) => {
      setView(() => m.AnotherAccountDialog);
    });
  }, [open, View]);
  return open && View !== null ? <View /> : null;
}

export function App(): JSX.Element {
  const path = currentPath.value;
  const goHome = () => {
    navigate('/');
  };

  return (
    <div className="bg-bg text-fur flex min-h-screen flex-col">
      <div className="max-w-layout-max mx-auto flex w-full flex-1 flex-col px-8 pb-8 max-sm:px-4">
        {!immersive.value && (
          <Nav
            brand={<img src={lockupUrl} alt={t('app.title')} width="138" height="28" />}
            brandHref="/"
            items={[
              { href: '/', label: t('nav.learn') },
              { href: '/type', label: t('nav.type') },
              { href: '/stats', label: t('nav.stats') },
              { href: '/settings', label: t('nav.settings') },
            ]}
            currentPath={path}
            onNavigate={navigate}
            ariaLabel={t('nav.label')}
            trailing={
              <>
                <LangSwitch />
                <SignInLink />
              </>
            }
          />
        )}

        {/* `/` says it on its own reserved notice line. */}
        {databaseMode.value === 'memory' && path !== '/' && (
          <p role="status" className="text-fur-dim text-ui-label mt-2">
            {t('storage.unavailable')}
          </p>
        )}

        {/* The page starts 48 px under the bar; a learning session has no bar and keeps the gap, 8 px on a
            phone (design `.page`, `.page--session`). */}
        <main className={cx('mt-12 flex flex-1 flex-col', immersive.value && 'max-sm:mt-2')}>
          <RouteView path={path} onHome={goHome} />
        </main>

        <AnotherAccount />

        {!immersive.value && (
          <Footer
            aboutHref="/about"
            aboutLabel={t('nav.about')}
            currentPath={path}
            onNavigate={navigate}
          />
        )}
      </div>
    </div>
  );
}
