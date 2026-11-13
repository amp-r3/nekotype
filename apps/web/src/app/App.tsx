import type { JSX } from 'preact';
import { t } from '@/shared/i18n';
import { cx, currentPath, databaseMode, immersive, navigate } from '@/shared/lib';
import { Footer, Nav } from '@/shared/ui';
import lockupUrl from '@/assets/logo/lockup.svg';
import { LangSwitch } from './lang-switch';
import { RouteView } from './route-view';

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
            trailing={<LangSwitch />}
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
