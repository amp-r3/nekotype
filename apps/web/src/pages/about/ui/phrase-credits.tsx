import type { JSX } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Notice } from '@/shared/ui';
import { Pagination } from '@/shared/ui/pagination';
import { loadCredits } from '@/entities/prompt';
import type { PhraseCredit } from '@/entities/prompt';
import { pageCount, slicePage, sortCredits } from '../lib/paging';

type State =
  | { readonly status: 'loading' }
  | { readonly status: 'failed' }
  | { readonly status: 'ready'; readonly credits: readonly PhraseCredit[] };

const TH = 'pr-3 pb-2 text-left font-normal';
const TD = 'border-line border-t py-2 pr-3 align-baseline';
const USER = 'text-mono-small text-fur font-mono';
const LINK = 'text-mono-small text-fur hover:text-eye font-mono underline underline-offset-2';

function Row({ credit }: { readonly credit: PhraseCredit }): JSX.Element {
  const id = String(credit.sentence.id);
  return (
    <tr data-testid="credit-row">
      <td className={`${TD} text-jp-body text-fur font-jp`} lang="ja">
        {credit.text}
      </td>
      <td className={TD}>
        <a
          className={LINK}
          href={`https://tatoeba.org/sentences/${id}`}
          aria-label={t('about.credits.sentenceLink', { id })}
          target="_blank"
          rel="noopener"
        >
          #{id}
        </a>
      </td>
      <td className={`${TD} ${USER}`} data-label={t('about.credits.author')}>
        {credit.sentence.author}
      </td>
      <td className={`${TD} ${USER}`} data-label={t('about.credits.translation')}>
        {credit.translation.author}
      </td>
      <td
        className={credit.transcriptionAuthor === null ? TD : `${TD} ${USER}`}
        data-label={t('about.credits.transcription')}
      >
        {credit.transcriptionAuthor ?? (
          <span className="text-ui-caption text-fur-dim">{t('about.credits.machine')}</span>
        )}
      </td>
    </tr>
  );
}

/**
 * The phrase authors list: one lazy chunk read whole, so a page change is synchronous. While the
 * chunk loads or fails only this place shows it (ADR 066).
 */
export function PhraseCredits(): JSX.Element {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [page, setPage] = useState(1);

  const load = useCallback((): void => {
    setState({ status: 'loading' });
    loadCredits().then(
      (credits) => {
        setState({ status: 'ready', credits: sortCredits(credits) });
      },
      () => {
        setState({ status: 'failed' });
      },
    );
  }, []);

  useEffect(load, [load]);

  const credits = state.status === 'ready' ? state.credits : null;
  const slice = useMemo(
    () => (credits === null ? null : slicePage(credits, page)),
    [credits, page],
  );

  if (state.status === 'loading') return <Notice loading>{t('about.credits.loading')}</Notice>;
  if (state.status === 'failed' || credits === null || slice === null) {
    return (
      <Notice
        tone="miss"
        action={
          <Button variant="secondary" size="sm" onClick={load}>
            {t('about.credits.retry')}
          </Button>
        }
      >
        {t('about.credits.error')}
      </Notice>
    );
  }

  const pages = pageCount(credits.length);
  return (
    <div className="nk-credits flex flex-col gap-4">
      <p role="status" className="text-ui-caption text-fur-dim">
        {t('about.credits.count', {
          from: String(slice.from),
          to: String(slice.to),
          total: String(credits.length),
        })}
      </p>
      <table className="w-full border-collapse" data-testid="credits-table">
        <thead>
          <tr className="text-ui-caption text-fur-dim">
            <th className={TH}>{t('about.credits.phrase')}</th>
            <th className={TH}>{t('about.credits.sentence')}</th>
            <th className={TH}>{t('about.credits.author')}</th>
            <th className={TH}>{t('about.credits.translation')}</th>
            <th className={TH}>{t('about.credits.transcription')}</th>
          </tr>
        </thead>
        <tbody>
          {slice.rows.map((credit) => (
            <Row key={credit.id} credit={credit} />
          ))}
        </tbody>
      </table>
      {pages > 1 && (
        <Pagination
          page={slice.page}
          pages={pages}
          onPage={setPage}
          labels={{
            prev: t('about.credits.previous'),
            next: t('about.credits.next'),
            label: t('about.credits.pages'),
          }}
        />
      )}
    </div>
  );
}
