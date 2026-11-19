import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ReportRequest } from '@nekotype/shared/types';
import { t } from '@/shared/i18n';
import type { TranslationKey } from '@/shared/i18n';
import { locale } from '@/shared/i18n';
import { useOnline } from '@/shared/lib';
import { Button, Dialog, Notice } from '@/shared/ui';
import { Select } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { CONTENT_VERSION } from '@/entities/prompt';
import { sendReport } from '../api/reports';
import type { ReportSender } from '../api/reports';
import { loadTurnstile, siteKeyFor } from '../lib/turnstile';
import type { TurnstileLoader } from '../lib/turnstile';

/** The prompt on display when the dialog was opened. */
export type ReportItem = {
  readonly id: string;
  readonly text: string;
  readonly phrase: boolean;
};

export type ReportDialogProps = {
  readonly open: boolean;
  readonly item: ReportItem;
  readonly onClose: () => void;
  // Tests replace the two outside calls: the script of Cloudflare and the request.
  readonly load?: TurnstileLoader;
  readonly send?: ReportSender;
};

type Reason = ReportRequest['reason'];
type Phase = 'form' | 'sending' | 'sent';
type Failure = 'verify' | 'send' | null;

const REASONS: readonly { readonly value: Reason; readonly label: TranslationKey }[] = [
  { value: 'wrong_reading', label: 'report.reasonReading' },
  { value: 'wrong_translation', label: 'report.reasonTranslation' },
  { value: 'other', label: 'report.reasonOther' },
];

const COMMENT_MAX = 500;

function reasonOf(value: string): Reason {
  return REASONS.find((reason) => reason.value === value)?.value ?? 'other';
}

/**
 * The report dialog (design decisions 23, 114–117, 127; p5-plan.md D21). It is a chunk of its own,
 * and the Turnstile script is added to the page only while it is open. The caller gives it a new
 * `key` for every opening, so each one starts from an empty form.
 */
export function ReportDialog({
  open,
  item,
  onClose,
  load = loadTurnstile,
  send = sendReport,
}: ReportDialogProps): JSX.Element {
  const online = useOnline();
  const [reason, setReason] = useState<Reason>('wrong_reading');
  const [comment, setComment] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [failure, setFailure] = useState<Failure>(null);
  const [scriptFailed, setScriptFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const widget = useRef<{ reset(): void } | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const sent = phase === 'sent';
  const sending = phase === 'sending';

  // The widget lives while the form is shown and the network is there; offline the script could
  // not load anyway, and it is tried again when the connection returns.
  useEffect(() => {
    const slot = slotRef.current;
    if (!open || sent || !online || slot === null) return undefined;
    let cancelled = false;
    let remove: (() => void) | null = null;
    setScriptFailed(false);
    load().then(
      (api) => {
        if (cancelled) return;
        const id = api.render(slot, {
          sitekey: siteKeyFor(window.location.hostname),
          theme: 'dark',
          size: 'flexible',
          language: locale.value,
          callback: (value) => {
            setToken(value);
          },
          'error-callback': () => {
            setToken(null);
            setScriptFailed(true);
          },
          'expired-callback': () => {
            setToken(null);
          },
        });
        widget.current = {
          reset: () => {
            api.reset(id);
          },
        };
        remove = () => {
          api.remove(id);
        };
      },
      () => {
        if (!cancelled) setScriptFailed(true);
      },
    );
    return () => {
      cancelled = true;
      widget.current = null;
      remove?.();
      setToken(null);
    };
  }, [open, sent, online, attempt, load]);

  useEffect(() => {
    if (sent) closeRef.current?.focus();
  }, [sent]);

  const submit = async (): Promise<void> => {
    if (token === null || phase !== 'form') return;
    const trimmed = comment.trim();
    setPhase('sending');
    setFailure(null);
    const outcome = await send({
      itemId: item.id,
      contentVersion: CONTENT_VERSION,
      reason,
      ...(trimmed === '' ? {} : { comment: trimmed }),
      turnstileToken: token,
    });
    if (outcome === 'sent') {
      setPhase('sent');
      return;
    }
    // A token is used once, whatever the outcome: the widget asks again.
    setToken(null);
    widget.current?.reset();
    setFailure(outcome === 'turnstile' ? 'verify' : 'send');
    setPhase('form');
  };

  let note: JSX.Element | undefined;
  if (!online) {
    note = <Notice>{t('report.offline')}</Notice>;
  } else if (scriptFailed) {
    note = (
      <Notice
        tone="miss"
        action={
          <Button
            variant="text"
            size="sm"
            onClick={() => {
              setAttempt((n) => n + 1);
            }}
          >
            {t('report.retry')}
          </Button>
        }
      >
        {t('report.verifyNotLoaded')}
      </Notice>
    );
  } else if (failure === 'verify') {
    note = <Notice tone="miss">{t('report.verifyFailed')}</Notice>;
  } else if (failure === 'send') {
    note = <Notice tone="miss">{t('report.sendFailed')}</Notice>;
  }

  const fieldsOff = !online || sending;

  return (
    <Dialog
      open={open}
      onClose={sending ? undefined : onClose}
      title={t(item.phrase ? 'report.titlePhrase' : 'report.titleWord')}
      closeLabel={t('report.close')}
      initialFocusRef={cancelRef}
      note={sent ? undefined : note}
      actions={
        sent ? (
          <Button variant="secondary" buttonRef={closeRef} onClick={onClose}>
            {t('report.close')}
          </Button>
        ) : (
          <>
            <Button variant="text" buttonRef={cancelRef} disabled={sending} onClick={onClose}>
              {t('report.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={fieldsOff || token === null || scriptFailed}
              onClick={() => {
                void submit();
              }}
            >
              {sending ? t('report.sending') : t('report.send')}
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <p className="text-fur-dim text-ui-body m-0">{t('report.sent')}</p>
      ) : (
        <>
          <p lang="ja" className="text-jp-body font-jp text-fur m-0 break-words">
            {item.text}
          </p>
          <Select
            label={t('report.reason')}
            options={REASONS.map((r) => ({ value: r.value, label: t(r.label) }))}
            value={reason}
            onChange={(value) => {
              setReason(reasonOf(value));
            }}
            disabled={fieldsOff}
            inDialog
            testId="report-reason"
          />
          <Textarea
            label={t('report.comment')}
            value={comment}
            onInput={setComment}
            maxLength={COMMENT_MAX}
            disabled={fieldsOff}
            testId="report-comment"
          />
          <div ref={slotRef} data-testid="report-widget" className="min-h-[65px] w-full" />
        </>
      )}
    </Dialog>
  );
}
