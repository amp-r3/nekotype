import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '@/shared/i18n';
import type { TranslationKey } from '@/shared/i18n';
import { useEnterForNext } from '@/shared/lib';
import { Button, Notice } from '@/shared/ui';
import { EmptyState } from '@/shared/ui/empty-state';
import { settingsReady } from '@/entities/settings';
import { isRoutePath } from './route-paths';
import type { RoutePath } from './route-paths';
import { ensureRoute, failedRoutes, loadedRoutes } from './route-state';

export type RouteViewProps = {
  readonly path: string;
  readonly onHome: () => void;
};

/** An address the app does not have: the neutral cat, a line of text and `go home` (design 404). */
function NotFound({ onHome }: { readonly onHome: () => void }): JSX.Element {
  // Enter is `go home` wherever the focus is (a control or a link keeps its own).
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

// The title a lazy screen keeps while its chunk loads or has failed (design "Loading and errors").
// `/` is in the first chunk and has no visible title.
const TITLES: Readonly<Partial<Record<RoutePath, TranslationKey>>> = {
  '/stats': 'page.stats',
  '/settings': 'page.settings',
  '/about': 'page.about',
};

/** The place of a lazy screen: its title, then the loading or failed notice under it. */
function Pending({
  path,
  children,
}: {
  readonly path: RoutePath;
  readonly children: JSX.Element;
}): JSX.Element {
  const title = TITLES[path];
  return (
    <section className="flex w-full flex-col gap-8 sm:gap-12">
      {title !== undefined && <h1 className="text-ui-title text-fur">{t(title)}</h1>}
      {children}
    </section>
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
      <Pending path={known}>
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
      </Pending>
    );
  }

  return (
    <Pending path={known}>
      <Notice reserve loading>
        {t('route.loading')}
      </Notice>
    </Pending>
  );
}
