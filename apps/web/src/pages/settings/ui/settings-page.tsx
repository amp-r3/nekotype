import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { t } from '@/shared/i18n';
import type { Strictness } from '@nekotype/engine';
import { Button, Dialog, ResetIcon, Segmented, Switch } from '@/shared/ui';
import { resetProgress } from '@/entities/stats';
import { resetLearning } from '@/entities/learn';
import {
  showTranslationSetting,
  setShowTranslation,
  learnStrictness,
  setLearnStrictness,
  learnTargetMs,
  setTargetMs,
} from '@/entities/settings';

export function SettingsPage(): JSX.Element {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const handleConfirmReset = () => {
    resetProgress();
    void resetLearning();
    setResetDialogOpen(false);
  };

  return (
    <section className="max-w-layout-test mx-auto flex w-full flex-col gap-8 py-12">
      <h1 className="text-ui-title text-fur">{t('page.settings')}</h1>

      <Switch
        checked={showTranslationSetting.value}
        onChange={setShowTranslation}
        label={t('settings.showTranslation')}
      />

      <div className="flex flex-col items-start gap-4">
        <h2 className="text-ui-body text-fur">{t('settings.learn.title')}</h2>
        <Segmented<Strictness>
          options={[
            { value: 'learner', label: t('config.strictness.learner') },
            { value: 'ime', label: t('config.strictness.ime') },
          ]}
          value={learnStrictness.value}
          onChange={setLearnStrictness}
          ariaLabel={t('settings.learn.strictness')}
        />
        <label className="text-fur text-ui-body flex flex-col gap-2">
          {t('settings.learn.target')}
          <span className="flex items-center gap-3">
            <input
              type="range"
              min={1000}
              max={3000}
              step={250}
              value={learnTargetMs.value}
              data-testid="settings-target-ms"
              onInput={(e) => {
                setTargetMs(Number(e.currentTarget.value));
              }}
            />
            <span className="text-fur-dim text-ui-label">
              {t('settings.learn.targetValue', { ms: learnTargetMs.value })}
            </span>
          </span>
        </label>
      </div>

      <div className="flex flex-col items-start gap-3">
        <p className="text-fur-dim text-ui-body">{t('settings.reset.description')}</p>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            setResetDialogOpen(true);
          }}
        >
          <ResetIcon size={14} />
          {t('app.reset')}
        </Button>
      </div>

      <Dialog
        open={resetDialogOpen}
        onClose={() => {
          setResetDialogOpen(false);
        }}
        title={t('reset.title')}
        closeLabel={t('dialog.close')}
      >
        <p className="text-fur-dim text-ui-body">{t('reset.confirm')}</p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="text"
            onClick={() => {
              setResetDialogOpen(false);
            }}
          >
            {t('reset.cancel')}
          </Button>
          <Button variant="danger" onClick={handleConfirmReset}>
            {t('reset.action')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
