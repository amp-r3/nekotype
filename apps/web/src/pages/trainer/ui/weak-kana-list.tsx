import type { JSX } from 'preact';
import { t } from '@/shared/i18n';
import type { WeakKana } from '../lib/results-model';

export type WeakKanaListProps = {
  readonly items: readonly WeakKana[];
};

/** The kana mistyped in this test (design WeakKanaList): kana, accepted spellings, errors. */
export function WeakKanaList({ items }: WeakKanaListProps): JSX.Element | null {
  if (items.length === 0) return null;

  return (
    <section data-testid="weak-kana" className="flex flex-col gap-2">
      <h2 className="text-fur-dim text-ui-label">{t('results.weakest')}</h2>
      <ul className="divide-line flex flex-col divide-y">
        {items.map((item) => (
          <li key={item.key} className="flex items-baseline gap-4 py-1.5">
            <span className="font-jp text-fur text-jp-cell w-10" lang="ja">
              {item.glyph}
            </span>
            <span className="text-fur-dim text-mono-small flex-1 font-mono">
              {item.spellings.join(' · ')}
            </span>
            <span
              className="text-fur text-mono-romaji font-mono tabular-nums"
              aria-label={`${t('results.errors')}: ${String(item.errors)}`}
            >
              {item.errors}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
