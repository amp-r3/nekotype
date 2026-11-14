import type { JSX } from 'preact';
import { t } from '@/shared/i18n';
import { Segmented } from '@/shared/ui';
import type { Period } from '../lib/selection';

/** The period switch of the typing filters and of the answer-time chart: 7 days, 30 days, all. */
export function PeriodSwitch({
  value,
  onChange,
}: {
  readonly value: Period;
  readonly onChange: (period: Period) => void;
}): JSX.Element {
  return (
    <Segmented<Period>
      ariaLabel={t('stats.filter.period')}
      value={value}
      options={[
        { value: '7', label: t('stats.filter.p7') },
        { value: '30', label: t('stats.filter.p30') },
        { value: 'all', label: t('stats.filter.all') },
      ]}
      onChange={onChange}
    />
  );
}
