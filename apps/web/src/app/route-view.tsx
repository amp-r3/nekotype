import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Notice } from '@/shared/ui';
import { EmptyState } from '@/shared/ui/empty-state';
import { settingsReady } from '@/entities/settings';
import { useEnterForNext } from '@/features/training';
import { isRoutePath } from './route-paths';
import { ensureRoute, failedRoutes, loadedRoutes } from './route-state';

export type RouteViewProps = {
  readonly path: string;
  readonly onHome: () => void;
};

/** An address the app does not have: the neutral cat, a line of text and `go home` (design 404). */
function NotFound({ onHome }: { readonly onHome: () => void }): JSX.Element {
  // Enter is `go home` wherever the focus is, as on the results (a control or a link keeps its own).
  useEnterForNext(onHome);
  return (
    <EmptyState
      mood="neutral"
      heading="h1"
      title={t('notFound.title')}
      text={t('notFound.text')}
      action={
        <Button variant="primary" onClick={onHome} hint={t('key.enter')}>
          {t('notFound.home')}
        </Button>
      }
    />
  );
}

export function RouteView({ path, onHome }: RouteViewProps): JSX.Element {
  const known = isRoutePath(path) ? path : null;
  const Page = known === null ? undefined : loadedRoutes.value.get(known);
  const failed = known !== null && failedRoutes.value.has(known);

  useEffect(() => {
    if (known !== null) void ensureRoute(known);
  }, [known]);

  if (known === null) return <NotFound onHome={onHome} />;

  // Screens read the settings; the shell around them has already been drawn.
  if (Page !== undefined && settingsReady.value) return <Page />;

  if (failed) {
    return (
      <Notice
        reserve
        tone="miss"
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void ensureRoute(known);
            }}
          >
            {t('route.retry')}
          </Button>
        }
      >
        {t('route.loadError')}
      </Notice>
    );
  }

  return (
    <Notice reserve loading>
      {t('route.loading')}
    </Notice>
  );
}
