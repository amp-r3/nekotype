import type { Track } from '@nekotype/shared/types';
import { t, tPlural } from '@/shared/i18n';
import { headOfRow } from '@/entities/learn';
import type { ForecastState, ShownForecast } from '@/entities/learn';

// The words of the forecast line (design decision 142).

/** The forecast line of a shown forecast: a range, or `about n` when low and high are the same. */
export function forecastText(forecast: ShownForecast): string {
  const head = headOfRow(forecast.row);
  const vowels = head === '';
  if (forecast.low === forecast.high) {
    return tPlural(vowels ? 'home.forecast.aboutVowels' : 'home.forecast.about', forecast.low, {
      head,
    });
  }
  return tPlural(vowels ? 'home.forecast.rangeVowels' : 'home.forecast.range', forecast.high, {
    head,
    low: forecast.low,
    high: forecast.high,
  });
}

/** The line a forecast state shows, or null while it is pending. */
export function forecastLine(state: ForecastState, track: Track): string | null {
  switch (state.kind) {
    case 'pending':
      return null;
    case 'ready':
      return forecastText(state.forecast);
    case 'beyond': {
      const head = headOfRow(state.row);
      return head === '' ? t('home.forecast.beyondVowels') : t('home.forecast.beyond', { head });
    }
    case 'complete':
      return t(`home.forecast.complete.${track}`);
  }
}
