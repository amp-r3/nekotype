import type { JSX } from 'preact';
import { t, locale, setLocale } from '@/shared/i18n';
import type { Locale } from '@/shared/i18n';
import { currentPath, databaseMode, immersive, navigate } from '@/shared/lib';
import { Footer, Nav, Segmented } from '@/shared/ui';
import lockupUrl from '@/assets/logo/lockup.svg';
import { RouteView } from './route-view';

export function App(): JSX.Element {
  const path = currentPath.value;
  const goHome = () => {
    navigate('/');
  };

  return (
    <div className="bg-bg text-fur flex min-h-screen flex-col">
      <div className="max-w-layout-max mx-auto flex w-full flex-1 flex-col px-4 pb-12">
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
              <Segmented<Locale>
                options={[
                  { value: 'en', label: 'en' },
                  { value: 'ru', label: 'ru' },
                ]}
                value={locale.value}
                onChange={(next) => {
                  void setLocale(next);
                }}
                ariaLabel={t('app.language')}
                size="sm"
              />
            }
          />
        )}

        {/* `/` says it on its own reserved notice line. */}
        {databaseMode.value === 'memory' && path !== '/' && (
          <p role="status" className="text-fur-dim text-ui-label mt-2">
            {t('storage.unavailable')}
          </p>
        )}

        <main className="mt-4 flex flex-1 flex-col">
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
