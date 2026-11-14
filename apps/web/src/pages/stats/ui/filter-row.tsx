import type { JSX } from 'preact';
import { t } from '@/shared/i18n';
import { Toggle } from '@/shared/ui';
import { Select } from '@/shared/ui/select';
import type { Filters, ModeOption } from '../lib/selection';
import { PeriodSwitch } from './period-switch';

export type FilterRowProps = {
  readonly filters: Filters;
  readonly modes: readonly ModeOption[];
  readonly onChange: (filters: Filters) => void;
};

/** The typing filters (design decision 105): mode, period, repeats. One row; stacked on a phone. */
export function FilterRow({ filters, modes, onChange }: FilterRowProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="w-full sm:w-auto sm:min-w-[320px]">
        <Select
          label={t('stats.filter.mode')}
          testId="stats-filter-mode"
          value={filters.mode}
          options={[
            { value: 'all', label: t('stats.filter.allModes') },
            ...modes.map((mode) => ({ value: mode.key, label: mode.label })),
          ]}
          onChange={(mode) => {
            onChange({ ...filters, mode });
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <PeriodSwitch
          value={filters.period}
          onChange={(period) => {
            onChange({ ...filters, period });
          }}
        />
        <Toggle
          pressed={filters.repeats}
          onChange={(repeats) => {
            onChange({ ...filters, repeats });
          }}
        >
          {t('stats.filter.repeats')}
        </Toggle>
      </div>
    </div>
  );
}
