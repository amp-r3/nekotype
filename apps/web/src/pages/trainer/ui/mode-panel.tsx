import type { JSX } from 'preact';
import { t } from '@/shared/i18n';
import { Segmented, Switch } from '@/shared/ui';
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

// The speed-test options: script, material and strictness in the first row, test, length, weak
// kana in the second (design: ModePanel).
export function ModePanel(): JSX.Element {
  const currentScript = scriptSetting.value;
  const currentContent = contentSetting.value;
  const currentStrictness = strictnessSetting.value;
  const currentWeakFocus = weakFocusSetting.value;
  const currentTestConfig = testConfig.value;

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

  const divider = <span aria-hidden="true" className="border-line hidden h-4 border-l sm:block" />;

  return (
    <div data-chrome className="flex w-full flex-col items-center gap-2 py-3 select-none">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Segmented<ScriptMode>
          options={[
            { value: 'hiragana', label: t('config.script.hiragana') },
            { value: 'katakana', label: t('config.script.katakana') },
            { value: 'both', label: t('config.script.both') },
          ]}
          value={currentScript}
          onChange={handleScriptChange}
          ariaLabel={t('config.script.label')}
        />
        {divider}
        <Segmented<ContentKind>
          options={[
            { value: 'words', label: t('config.content.words') },
            { value: 'phrases', label: t('config.content.phrases') },
          ]}
          value={currentContent}
          onChange={handleContentChange}
          ariaLabel={t('config.content.label')}
        />
        {divider}
        <Segmented<Strictness>
          options={[
            { value: 'learner', label: t('config.strictness.learner') },
            { value: 'ime', label: t('config.strictness.ime') },
          ]}
          value={currentStrictness}
          onChange={handleStrictnessChange}
          ariaLabel={t('config.strictness.label')}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Segmented<'time' | 'count' | 'zen'>
          options={[
            { value: 'time', label: t('config.test.time') },
            { value: 'count', label: t('config.test.count') },
            { value: 'zen', label: t('config.test.zen') },
          ]}
          value={currentTestConfig.kind}
          onChange={handleTestKindChange}
          ariaLabel={t('config.test.label')}
        />
        {
          currentTestConfig.kind === 'time' ? (
            <Segmented<15 | 30 | 60 | 120>
              options={[
                { value: 15, label: t('config.seconds.option', { n: 15 }) },
                { value: 30, label: t('config.seconds.option', { n: 30 }) },
                { value: 60, label: t('config.seconds.option', { n: 60 }) },
                { value: 120, label: t('config.seconds.option', { n: 120 }) },
              ]}
              value={currentTestConfig.seconds}
              onChange={handleTimeSecondsChange}
              ariaLabel={t('config.seconds.label')}
            />
          ) : currentTestConfig.kind === 'count' ? (
            <Segmented<10 | 25 | 50 | 100>
              options={[
                { value: 10, label: '10' },
                { value: 25, label: '25' },
                { value: 50, label: '50' },
                { value: 100, label: '100' },
              ]}
              value={currentTestConfig.prompts}
              onChange={handleCountPromptsChange}
              ariaLabel={t('config.prompts.label')}
            />
          ) : null /* Zen has no length: it goes on until it is ended by hand. */
        }
        {divider}
        <Switch
          checked={currentWeakFocus}
          onChange={handleWeakFocusChange}
          label={t('config.weakFocus')}
        />
      </div>
    </div>
  );
}
