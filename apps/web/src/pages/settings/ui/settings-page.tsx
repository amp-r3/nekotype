import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { t } from '@/shared/i18n';
import { Button, Dialog, ResetIcon, Switch } from '@/shared/ui';
import { resetProgress } from '@/entities/stats';
import { showTranslationSetting, setShowTranslation } from '@/entities/settings';

export function SettingsPage(): JSX.Element {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const handleConfirmReset = () => {
    resetProgress();
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
