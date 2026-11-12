import type { JSX } from 'preact';
import { t } from '@/shared/i18n';

// Data, not translated: licence names, the repository and the font families.
const AGPL = 'AGPL-3.0-only';
const OFL = 'OFL-1.1';
const REPOSITORY = 'github.com/amp-r3/nekotype';
const FONT_FAMILIES = 'Golos Text, JetBrains Mono, Noto Sans JP';

const LINK = 'text-fur hover:text-eye underline underline-offset-2';

type Licence = { readonly name: string; readonly href: string | null };

type Row = {
  readonly name: string;
  readonly href: string;
  readonly use: string;
  readonly licence: Licence;
  readonly holder: string;
};

// Licence names, links and the data names are not translated.
const CC_BY_SA = { name: 'CC BY-SA 4.0', href: 'https://creativecommons.org/licenses/by-sa/4.0/' };

function Rows({ rows }: { readonly rows: readonly Row[] }): JSX.Element {
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li
          key={row.name}
          className="border-line flex flex-col gap-1 border-t py-3 first:border-t-0 first:pt-0"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <span>
              <a
                className={`${LINK} text-ui-label`}
                href={row.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {row.name}
              </a>{' '}
              <span className="text-fur-dim text-ui-label">{row.use}</span>
            </span>
            {row.licence.href === null ? (
              <span className="text-ui-label text-fur">{row.licence.name}</span>
            ) : (
              <a
                className={`${LINK} text-ui-label`}
                href={row.licence.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {row.licence.name}
              </a>
            )}
          </div>
          <div className="text-ui-caption text-fur-dim">{row.holder}</div>
        </li>
      ))}
    </ul>
  );
}

/** Section 1: the four sources and their licences (A3: Waller's `CC BY` has no version, no link). */
export function SourcesSection(): JSX.Element {
  const rows: readonly Row[] = [
    {
      name: 'JMdict',
      href: 'https://www.edrdg.org/jmdict/j_jmdict.html',
      use: t('about.sources.jmdict.use'),
      licence: CC_BY_SA,
      holder: t('about.sources.jmdict.holder'),
    },
    {
      name: 'Tatoeba',
      href: 'https://tatoeba.org',
      use: t('about.sources.tatoeba.use'),
      licence: { name: 'CC BY 2.0 FR', href: 'https://creativecommons.org/licenses/by/2.0/fr/' },
      holder: t('about.sources.tatoeba.holder'),
    },
    {
      name: t('about.sources.jlpt.name'),
      href: 'https://www.tanos.co.uk/jlpt/',
      use: t('about.sources.jlpt.use'),
      licence: { name: 'CC BY', href: null },
      holder: 'Jonathan Waller, tanos.co.uk',
    },
    {
      name: t('about.sources.mapping.name'),
      href: 'https://github.com/stephenmk/yomitan-jlpt-vocab',
      use: t('about.sources.mapping.use'),
      licence: CC_BY_SA,
      holder: 'stephenmk/yomitan-jlpt-vocab',
    },
  ];
  return (
    <section aria-labelledby="about-sources" className="flex flex-col gap-4">
      <h2 id="about-sources" className="text-ui-heading text-fur">
        {t('about.sources.title')}
      </h2>
      <Rows rows={rows} />
      <p className="text-ui-body text-fur-dim">{t('about.sources.generated')}</p>
    </section>
  );
}

/** Section 2: the terms of Nekotype itself, as in NOTICE.md. */
export function TermsSection(): JSX.Element {
  return (
    <section aria-labelledby="about-terms" className="flex flex-col gap-4">
      <h2 id="about-terms" className="text-ui-heading text-fur">
        {t('about.terms.title')}
      </h2>
      <ul className="flex flex-col">
        <li className="flex flex-col gap-1 pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6">
            <span className="text-ui-label text-fur">{t('about.terms.code')}</span>
            <a
              className={`${LINK} text-ui-label`}
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              {AGPL}
            </a>
          </div>
          <div className="text-ui-caption text-fur-dim">
            {t('about.terms.codeHolder')}{' '}
            <a
              className={LINK}
              href="https://github.com/amp-r3/nekotype"
              target="_blank"
              rel="noopener noreferrer"
            >
              {REPOSITORY}
            </a>
          </div>
        </li>
        <li className="border-line flex flex-wrap items-baseline justify-between gap-x-6 border-t py-3">
          <span className="text-ui-label text-fur">{t('about.terms.name')}</span>
          <span className="text-ui-label text-fur-dim">{t('about.terms.reserved')}</span>
        </li>
        <li className="border-line flex flex-col gap-1 border-t pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6">
            <span className="text-ui-label text-fur">{t('about.terms.fonts')}</span>
            <a
              className={`${LINK} text-ui-label`}
              href="https://openfontlicense.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              {OFL}
            </a>
          </div>
          <div className="text-ui-caption text-fur-dim">{FONT_FAMILIES}</div>
        </li>
      </ul>
    </section>
  );
}
