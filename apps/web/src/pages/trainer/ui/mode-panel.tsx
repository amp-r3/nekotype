import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { useMediaQuery } from '@/shared/lib';
import { Segmented, Toggle } from '@/shared/ui';
import { cx } from '@/shared/lib';
import {
  scriptSetting,
  contentSetting,
  strictnessSetting,
  weakFocusSetting,
  setScript,
  setContent,
  setStrictness,
  setWeakFocus,
  testConfig,
  setTestConfig,
  DEFAULT_TIME_TEST,
  DEFAULT_COUNT_TEST,
} from '@/entities/settings';
import type { ScriptMode, ContentKind } from '@/entities/settings';
import type { Strictness } from '@/entities/prompt';

// The one line that names the mode while the bar is folded: `words · hiragana · relaxed · 30 s`.
function modeSummary(
  content: ContentKind,
  script: ScriptMode,
  strictness: Strictness,
  config: ReturnType<typeof testConfig.peek>,
  weakFocus: boolean,
): string {
  const length =
    config.kind === 'time'
      ? t('config.seconds.summary', { n: config.seconds })
      : config.kind === 'count'
        ? t('config.prompts.summary', { n: config.prompts })
        : t('config.test.zen');
  return [
    t(`config.content.${content}`),
    t(`config.script.${script}`),
    t(`config.strictness.${strictness}`),
    length,
    ...(weakFocus ? [t('config.weakFocus')] : []),
  ]
    .map((part) => part.toLocaleLowerCase())
    .join(' · ');
}

// The speed-test options: script, material and strictness in the first row, test, length, weak
// kana in the second (design: ModePanel).
export function ModePanel(): JSX.Element {
  const currentScript = scriptSetting.value;
  const currentContent = contentSetting.value;
  const currentStrictness = strictnessSetting.value;
  const currentWeakFocus = weakFocusSetting.value;
  const currentTestConfig = testConfig.value;
  // Below 640 px the bar is folded into one line with a button that opens it (ADR 059).
  const narrow = useMediaQuery('(max-width: 639px)');
  const [open, setOpen] = useState(false);

  const handleScriptChange = (val: ScriptMode) => {
    setScript(val);
  };

  const handleContentChange = (val: ContentKind) => {
    setContent(val);
  };

  const handleStrictnessChange = (val: Strictness) => {
    setStrictness(val);
  };

  const handleWeakFocusChange = (val: boolean) => {
    setWeakFocus(val);
  };

  const handleTestKindChange = (kind: 'time' | 'count' | 'zen') => {
    if (kind === 'time') {
      setTestConfig(DEFAULT_TIME_TEST);
    } else if (kind === 'count') {
      setTestConfig(DEFAULT_COUNT_TEST);
    } else {
      setTestConfig({ kind: 'zen' });
    }
  };

  const handleTimeSecondsChange = (seconds: 15 | 30 | 60 | 120) => {
    setTestConfig({ kind: 'time', seconds });
  };

  const handleCountPromptsChange = (prompts: 10 | 25 | 50 | 100) => {
    setTestConfig({ kind: 'count', prompts });
  };

  const compact = narrow;
  const folded = compact && !open;

  // A group of a row: a divider between every two groups on a wide screen; on a phone each group
  // is one line under a caption, and the caption is only for screen readers on a wide screen.
  const group = (label: string | null, node: JSX.Element): JSX.Element => (
    <div
      className={cx(
        'flex',
        compact
          ? 'flex-col items-start'
          : 'border-line items-center [&:not(:first-child)]:ml-4 [&:not(:first-child)]:border-l [&:not(:first-child)]:pl-4',
      )}
    >
      {label !== null && (
        <span className={compact ? 'text-ui-caption text-fur-dim' : 'sr-only'}>{label}</span>
      )}
      {node}
    </div>
  );
  const row =
    'flex flex-wrap items-center justify-center gap-y-2 max-sm:flex-col max-sm:items-stretch max-sm:gap-3';

  return (
    <div
      data-chrome
      className={cx(
        'flex w-full flex-col gap-2 select-none',
        compact ? 'items-stretch' : 'items-center',
      )}
    >
      {compact && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
          className="text-ui-label text-fur border-line min-h-touch-min flex w-full cursor-pointer items-center justify-between gap-3 border-0 border-b bg-transparent p-0 text-left"
        >
          <span>
            <span className="sr-only">{t('config.mode')}</span>
            {modeSummary(
              currentContent,
              currentScript,
              currentStrictness,
              currentTestConfig,
              currentWeakFocus,
            )}
          </span>
          <span
            aria-hidden="true"
            className={cx(
              'border-fur-dim -mt-[3px] mr-1 h-[6px] w-[6px] flex-none border-r border-b transition-transform',
              open ? 'translate-y-[3px] -rotate-[135deg]' : 'rotate-45',
            )}
          />
        </button>
      )}
      {!folded && (
        <div
          className={cx(
            'flex flex-col gap-2',
            compact ? 'items-stretch gap-3 pt-3' : 'items-center',
          )}
        >
          <div className={row}>
            {group(
              t('config.script.label'),
              <Segmented<ScriptMode>
                options={[
                  { value: 'hiragana', label: t('config.script.hiragana') },
                  { value: 'katakana', label: t('config.script.katakana') },
                  { value: 'both', label: t('config.script.both') },
                ]}
                value={currentScript}
                onChange={handleScriptChange}
                ariaLabel={t('config.script.label')}
              />,
            )}
            {group(
              t('config.content.label'),
              <Segmented<ContentKind>
                options={[
                  { value: 'words', label: t('config.content.words') },
                  { value: 'phrases', label: t('config.content.phrases') },
                ]}
                value={currentContent}
                onChange={handleContentChange}
                ariaLabel={t('config.content.label')}
              />,
            )}
            {group(
              t('config.strictness.label'),
              <Segmented<Strictness>
                options={[
                  { value: 'learner', label: t('config.strictness.learner') },
                  { value: 'ime', label: t('config.strictness.ime') },
                ]}
                value={currentStrictness}
                onChange={handleStrictnessChange}
                ariaLabel={t('config.strictness.label')}
              />,
            )}
          </div>

          <div className={row}>
            {group(
              t('config.test.label'),
              <Segmented<'time' | 'count' | 'zen'>
                options={[
                  { value: 'time', label: t('config.test.time') },
                  { value: 'count', label: t('config.test.count') },
                  { value: 'zen', label: t('config.test.zen') },
                ]}
                value={currentTestConfig.kind}
                onChange={handleTestKindChange}
                ariaLabel={t('config.test.label')}
              />,
            )}
            {
              currentTestConfig.kind === 'time'
                ? group(
                    t('config.seconds.label'),
                    <Segmented<15 | 30 | 60 | 120>
                      mono
                      options={[
                        { value: 15, label: t('config.seconds.option', { n: 15 }) },
                        { value: 30, label: t('config.seconds.option', { n: 30 }) },
                        { value: 60, label: t('config.seconds.option', { n: 60 }) },
                        { value: 120, label: t('config.seconds.option', { n: 120 }) },
                      ]}
                      value={currentTestConfig.seconds}
                      onChange={handleTimeSecondsChange}
                      ariaLabel={t('config.seconds.label')}
                    />,
                  )
                : currentTestConfig.kind === 'count'
                  ? group(
                      t('config.prompts.label'),
                      <Segmented<10 | 25 | 50 | 100>
                        mono
                        options={[
                          { value: 10, label: '10' },
                          { value: 25, label: '25' },
                          { value: 50, label: '50' },
                          { value: 100, label: '100' },
                        ]}
                        value={currentTestConfig.prompts}
                        onChange={handleCountPromptsChange}
                        ariaLabel={t('config.prompts.label')}
                      />,
                    )
                  : null /* Zen has no length: it goes on until it is ended by hand. */
            }
            {group(
              null,
              <Toggle pressed={currentWeakFocus} onChange={handleWeakFocusChange}>
                {t('config.weakFocus')}
              </Toggle>,
            )}
          </div>
        </div>
      )}
    </div>
  );
}
