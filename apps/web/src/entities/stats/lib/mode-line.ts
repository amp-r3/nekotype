import type { TestResult } from '@nekotype/shared/types';
import { t } from '@/shared/i18n';

/** What a personal best is kept by: content, script, strictness and the test mode. */
export type ModeParts = Pick<TestResult, 'content' | 'script' | 'strictness' | 'config'>;

/** The test mode as shown: `60 s`, `25`, `zen`. */
export function modeLabel(config: TestResult['config']): string {
  return config.kind === 'time'
    ? t('mode.time', { n: config.seconds })
    : config.kind === 'count'
      ? t('mode.count', { n: config.prompts })
      : t('mode.zen');
}

/** The mode line of the design: `words · hiragana · relaxed · 60 s`. */
export function modeLine(parts: ModeParts): string {
  return t('mode.line', {
    content: t(`mode.content.${parts.content}`),
    script: t(`mode.script.${parts.script}`),
    strictness: t(`mode.strictness.${parts.strictness}`),
    mode: modeLabel(parts.config),
  });
}
