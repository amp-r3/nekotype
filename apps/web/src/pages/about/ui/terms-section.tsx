import type { JSX } from 'preact';
import { t } from '@/shared/i18n';

// Data, not translated: licence names, the repository and the font families.
const AGPL = 'AGPL-3.0-only';
const OFL = 'OFL-1.1';
const REPOSITORY = 'github.com/amp-r3/nekotype';
const FONT_FAMILIES = 'Golos Text, JetBrains Mono, Noto Sans JP';

const LINK = 'text-fur hover:text-eye underline underline-offset-2';

/** The terms of Nekotype itself, as in NOTICE.md. */
export function TermsSection(): JSX.Element {
  return (
    <section aria-labelledby="about-terms" className="flex max-w-[720px] flex-col gap-4">
      <h2 id="about-terms" className="text-ui-heading text-fur">
        {t('about.terms.title')}
      </h2>
      <ul className="flex flex-col">
        <li className="border-line flex flex-col gap-1 border-t py-3">
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
