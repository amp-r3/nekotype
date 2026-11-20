import type { JSX } from 'preact';
import { t } from '@/shared/i18n';
import { TermsSection } from './terms-section';

// The sections "Kana audio" (P8) and "Data on this device" (P12) are not rendered before their phases (ADR 066).
export function AboutPage(): JSX.Element {
  return (
    <section className="max-w-layout-max mx-auto flex w-full flex-col gap-12">
      <h1 className="text-ui-title text-fur">{t('page.about')}</h1>
      <TermsSection />
    </section>
  );
}
