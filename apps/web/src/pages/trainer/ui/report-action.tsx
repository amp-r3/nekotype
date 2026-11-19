import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { ReadonlySignal } from '@preact/signals';
import { t } from '@/shared/i18n';
import { useOnline } from '@/shared/lib';
import type { PromptItem } from '@/entities/prompt';
import { loadReportDialog } from '../report-loader';
import type { ReportDialog, ReportItem } from './report-dialog';

type DialogProps = Parameters<typeof ReportDialog>[0];

export type ReportActionProps = {
  /** The prompt on display; read when the button is pressed, never while rendering. */
  readonly currentPrompt: ReadonlySignal<PromptItem | null>;
  /** Whether the line is hidden (no prompt, or the translation is off). */
  readonly hidden: ReadonlySignal<boolean>;
  /** Gives the keyboard back to the hidden field once the dialog closes. */
  readonly onClosed: () => void;
  /** Tests replace the outside calls of the dialog. */
  readonly dialogDeps?: Pick<DialogProps, 'load' | 'send'>;
};

type Opened = { readonly n: number; readonly item: ReportItem; readonly open: boolean };

/**
 * `report a problem` in the translation line (design TranslationLine). It does not read a signal
 * that a keystroke changes while rendering, so typing renders nothing here. Offline it is disabled
 * and says why in its `title`.
 */
export function ReportAction({
  currentPrompt,
  hidden,
  onClosed,
  dialogDeps = {},
}: ReportActionProps): JSX.Element {
  const online = useOnline();
  const [Dialog, setDialog] = useState<typeof ReportDialog | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);

  const open = (): void => {
    const prompt = currentPrompt.peek();
    if (prompt === null) return;
    const item: ReportItem = {
      id: prompt.key,
      text: prompt.text,
      phrase: prompt.tatoebaId !== undefined,
    };
    void loadReportDialog().then((loaded) => {
      if (loaded === null) return;
      setDialog(() => loaded);
      setOpened((previous) => ({ n: (previous?.n ?? 0) + 1, item, open: true }));
    });
  };

  const close = (): void => {
    setOpened((previous) => (previous === null ? null : { ...previous, open: false }));
    onClosed();
  };

  return (
    <>
      <button
        type="button"
        data-testid="report-action"
        hidden={hidden}
        disabled={!online}
        title={online ? undefined : t('report.offlineHint')}
        // A press must not move the keyboard out of the hidden field before the dialog opens.
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onClick={(e) => {
          e.stopPropagation();
          open();
        }}
        className="text-ui-caption hover:text-fur decoration-line-strong hover:decoration-fur-dim disabled:text-fur-faint cursor-pointer underline underline-offset-[3px] transition-colors disabled:cursor-default disabled:no-underline"
      >
        {t('report.action')}
      </button>
      {Dialog !== null && opened !== null && (
        <Dialog
          key={opened.n}
          open={opened.open}
          item={opened.item}
          onClose={close}
          {...dialogDeps}
        />
      )}
    </>
  );
}
