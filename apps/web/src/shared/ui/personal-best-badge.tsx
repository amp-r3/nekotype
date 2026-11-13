import type { JSX } from 'preact';
import { t } from '@/shared/i18n';

/** The personal best mark: an `eye` outline, no fill (design PersonalBestBadge). */
export function PersonalBestBadge(): JSX.Element {
  return (
    <span className="border-eye text-eye text-ui-caption inline-flex h-5 items-center rounded-xs border px-2 whitespace-nowrap">
      {t('badge.personalBest')}
    </span>
  );
}
