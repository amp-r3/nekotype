import type { JSX } from 'preact';
import { t } from '@/shared/i18n';

/** The personal best mark: an `eye` outline, no fill (design PersonalBestBadge). */
export function PersonalBestBadge(): JSX.Element {
  return (
    <span className="border-eye text-eye text-ui-caption rounded-xs border px-1.5">
      {t('badge.personalBest')}
    </span>
  );
}
