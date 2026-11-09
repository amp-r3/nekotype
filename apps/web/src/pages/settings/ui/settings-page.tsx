import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { t } from '@/shared/i18n';
import type { Strictness } from '@nekotype/engine';
import { Button, Dialog, ResetIcon, Segmented, Switch } from '@/shared/ui';
import { Select } from '@/shared/ui/select';
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

// 1000 to 3000 ms in steps of 250: nine values, which do not fit one row of segments at 360 px.
const TARGETS = Array.from({ length: 9 }, (_, step) => 1000 + step * 250);

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ComponentChildren;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-ui-heading text-fur">{title}</h2>
      {children}
    </section>
  );
}

// A setting: the name and what it does on the left, the control on the right (under the text on a
// phone).
function SettingRow({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint: string;
  readonly children: ComponentChildren;
}): JSX.Element {
  return (
    <div className="flex w-full items-center justify-between gap-6 max-sm:flex-col max-sm:items-start max-sm:gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-ui-label text-fur">{label}</span>
        <span className="text-ui-caption text-fur-dim">{hint}</span>
      </div>
      {children}
    </div>
  );
}

export function SettingsPage(): JSX.Element {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const handleConfirmReset = () => {
    resetProgress();
    void resetLearning();
    setResetDialogOpen(false);
  };

  return (
    <section className="mx-auto flex w-full max-w-[640px] flex-col gap-12 py-12">
      <h1 className="text-ui-title text-fur">{t('page.settings')}</h1>

      <Section title={t('settings.learn.title')}>
        <SettingRow
          label={t('settings.learn.strictness')}
          hint={t('settings.learn.strictnessHint')}
        >
          <Segmented<Strictness>
            options={[
              { value: 'learner', label: t('settings.learn.relaxed') },
              { value: 'ime', label: t('settings.learn.strictIme') },
            ]}
            value={learnStrictness.value}
            onChange={setLearnStrictness}
            ariaLabel={t('settings.learn.strictness')}
          />
        </SettingRow>
        <SettingRow label={t('settings.learn.target')} hint={t('settings.learn.targetHint')}>
          <div className="w-[160px] flex-none max-sm:w-full">
            <Select
              ariaLabel={t('settings.learn.target')}
              testId="settings-target-ms"
              value={String(learnTargetMs.value)}
              options={TARGETS.map((ms) => ({
                value: String(ms),
                label: t('settings.learn.targetValue', { ms }),
              }))}
              onChange={(value) => {
                setTargetMs(Number(value));
              }}
            />
          </div>
        </SettingRow>
      </Section>

      <Section title={t('settings.typing.title')}>
        <Switch
          checked={showTranslationSetting.value}
          onChange={setShowTranslation}
          label={t('settings.showTranslation')}
          description={t('settings.showTranslationHint')}
        />
      </Section>

      <Section title={t('settings.data.title')}>
        <SettingRow label={t('settings.data.reset')} hint={t('settings.reset.description')}>
          <Button
            variant="danger"
            onClick={() => {
              setResetDialogOpen(true);
            }}
          >
            <ResetIcon size={14} />
            {t('settings.data.resetAction')}
          </Button>
        </SettingRow>
      </Section>

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
