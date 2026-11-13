import type { JSX } from 'preact';
import { t } from '@/shared/i18n';
import type { WeakKana } from '../lib/results-model';

export type WeakKanaListProps = {
  readonly items: readonly WeakKana[];
  readonly style?: string;
};

const TH = 'pr-3 pb-2 text-left font-normal';
const TD = 'border-line border-t py-2 pr-3 align-baseline';

/** The kana mistyped in this test (design WeakKanaList): kana, accepted spellings, errors. */
export function WeakKanaList({ items, style }: WeakKanaListProps): JSX.Element | null {
  if (items.length === 0) return null;

  return (
    <section
      data-testid="weak-kana"
      className="animate-reveal flex max-w-[560px] flex-col gap-4"
      style={style}
    >
      <h2 className="text-ui-heading text-fur">{t('results.weakest')}</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-ui-caption text-fur-dim">
            <th className={TH}>{t('results.colKana')}</th>
            <th className={TH}>{t('results.colRomaji')}</th>
            <th className={`${TH} text-right`}>{t('results.errors')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key}>
              <td className={`${TD} font-jp text-fur text-jp-cell w-14`} lang="ja">
                {item.glyph}
              </td>
              <td className={`${TD} text-fur-dim text-mono-small font-mono`}>
                {item.spellings.join(' · ')}
              </td>
              <td className={`${TD} text-fur text-mono-romaji text-right font-mono tabular-nums`}>
                {item.errors}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
