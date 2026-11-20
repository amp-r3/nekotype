import type { ComponentChildren, ComponentType, JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '@/shared/i18n';
import type { Strictness } from '@nekotype/engine';
import { Button, Dialog, ResetIcon, Segmented } from '@/shared/ui';
import { Select } from '@/shared/ui/select';
import { resetLearning } from '@/entities/learn';
import { authAvailable, beginSignIn, userId } from '@/entities/user';
import {
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

// A guest's account section: what signing in gives and the two buttons, which a preview does not
// offer (p5-plan.md, D20). It imports `entities/user` only, so the sync chunk stays unloaded.
function GuestAccount(): JSX.Element {
  return (
    <Section title={t('settings.account.title')}>
      <p className="text-fur-dim text-ui-body">{t('settings.account.guest')}</p>
      {authAvailable.value && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              void beginSignIn('google');
            }}
          >
            {t('settings.account.google')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void beginSignIn('github');
            }}
          >
            {t('settings.account.github')}
          </Button>
        </div>
      )}
    </Section>
  );
}

// The account section of a signed-in user is a chunk of its own, with the sync engine (D17).
function AccountSection(): JSX.Element | null {
  const [Panel, setPanel] = useState<ComponentType | null>(null);
  useEffect(() => {
    void import('./account-panel').then((m) => {
      setPanel(() => m.AccountPanel);
    });
  }, []);
  return Panel === null ? null : <Panel />;
}

export function SettingsPage(): JSX.Element {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const signedIn = userId.value !== null;

  const handleConfirmReset = () => {
    void resetLearning();
    setResetDialogOpen(false);
  };

  return (
    <section className="mx-auto flex w-full max-w-[640px] flex-col gap-12">
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

      {/* Reset progress is for guests only, an expired session included (A33). */}
      {signedIn ? null : (
        <Section title={t('settings.data.title')}>
          <SettingRow label={t('settings.data.reset')} hint={t('settings.reset.description')}>
            <Button
              variant="danger"
              onClick={() => {
                setResetDialogOpen(true);
              }}
            >
              <ResetIcon />
              {t('settings.data.resetAction')}
            </Button>
          </SettingRow>
        </Section>
      )}

      {signedIn ? <AccountSection /> : <GuestAccount />}

      <Dialog
        open={resetDialogOpen}
        onClose={() => {
          setResetDialogOpen(false);
        }}
        title={t('reset.title')}
        closeLabel={t('dialog.close')}
        initialFocusRef={cancelRef}
      >
        <p className="text-fur-dim text-ui-body">{t('reset.confirm')}</p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="text"
            buttonRef={cancelRef}
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
