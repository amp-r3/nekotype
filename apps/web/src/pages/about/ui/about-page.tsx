import type { JSX } from 'preact';
import { t } from '@/shared/i18n';
import { PhraseCredits } from './phrase-credits';
import { SourcesSection, TermsSection } from './source-rows';

// The P6 (kana audio) and P7 (stored data) sections are not rendered before their phases (ADR 066).
export function AboutPage(): JSX.Element {
  return (
    <section className="max-w-layout-max mx-auto flex w-full flex-col gap-12">
      <h1 className="text-ui-title text-fur">{t('page.about')}</h1>
      <SourcesSection />
      <TermsSection />
      <section aria-labelledby="about-credits" className="flex flex-col gap-4">
        <h2 id="about-credits" className="text-ui-heading text-fur">
          {t('about.credits.title')}
        </h2>
        <div className="flex max-w-[720px] flex-col gap-2">
          <p className="text-ui-body text-fur-dim">{t('about.credits.intro1')}</p>
          <p className="text-ui-body text-fur-dim">{t('about.credits.intro2')}</p>
        </div>
        <div className="mt-2">
          <PhraseCredits />
        </div>
      </section>
    </section>
  );
}
