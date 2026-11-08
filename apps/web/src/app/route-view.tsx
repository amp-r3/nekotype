import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import { settingsReady } from '@/entities/settings';
import { isRoutePath } from './route-paths';
import { ensureRoute, failedRoutes, loadedRoutes } from './route-state';

export type RouteViewProps = {
  readonly path: string;
  readonly onHome: () => void;
};

export function RouteView({ path, onHome }: RouteViewProps): JSX.Element {
  const known = isRoutePath(path) ? path : null;
  const Page = known === null ? undefined : loadedRoutes.value.get(known);
  const failed = known !== null && failedRoutes.value.has(known);

  useEffect(() => {
    if (known !== null) void ensureRoute(known);
  }, [known]);

  if (known === null) {
    return (
      <section className="max-w-layout-test mx-auto flex w-full flex-col items-start gap-4 py-12">
        <h1 className="text-ui-title text-fur">{t('notFound.title')}</h1>
        <Button variant="secondary" onClick={onHome}>
          {t('notFound.home')}
        </Button>
      </section>
    );
  }

  // Screens read the settings; the shell around them has already been drawn.
  if (Page !== undefined && settingsReady.value) return <Page />;

  if (failed) {
    return (
      <section className="max-w-layout-test mx-auto flex w-full flex-col items-start gap-4 py-12">
        <p role="alert" className="text-miss text-ui-body">
          {t('route.loadError')}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            void ensureRoute(known);
          }}
        >
          {t('route.retry')}
        </Button>
      </section>
    );
  }

  return (
    <p role="status" className="text-fur-dim text-ui-label py-12 text-center">
      {t('route.loading')}
    </p>
  );
}
