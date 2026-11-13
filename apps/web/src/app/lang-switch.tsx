import type { JSX } from 'preact';
import { t, locale, setLocale } from '@/shared/i18n';
import type { Locale } from '@/shared/i18n';
import { cx } from '@/shared/lib';

const LOCALES: readonly Locale[] = ['en', 'ru'];

/**
 * The interface language: two `mono-small` buttons, the chosen one `fur` with an `eye` underline
 * (design `nk-lang`). A switch of a mode, not of a view, so it is `aria-pressed`, not a radio group.
 */
export function LangSwitch(): JSX.Element {
  return (
    <div role="group" aria-label={t('app.language')} className="inline-flex gap-1">
      {LOCALES.map((code) => {
        const on = locale.value === code;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={on}
            onClick={() => {
              if (!on) void setLocale(code);
            }}
            className={cx(
              'text-mono-small pointer-coarse:min-h-touch-min inline-flex cursor-pointer items-center rounded-xs px-1 font-mono transition-colors',
              on
                ? 'text-fur decoration-eye underline decoration-2 underline-offset-[5px]'
                : 'text-fur-dim hover:text-fur',
            )}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
