import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { cx } from '../lib';

export type DialogProps = {
  readonly open: boolean;
  // Omitted while a request runs (design decisions 115, 122): no `✕`, `Esc` and the backdrop do nothing.
  readonly onClose?: (() => void) | undefined;
  readonly title: string;
  readonly closeLabel: string;
  // The safe action comes first and receives the initial focus (design Dialog); without it the
  // dialog's own first control, `✕`, gets it.
  readonly initialFocusRef?: { readonly current: HTMLElement | null };
  readonly children: ComponentChildren;
  // One reserved line (a `Notice`) in the actions row, left of the buttons (decision 127).
  readonly note?: ComponentChildren;
  readonly actions?: ComponentChildren;
  readonly className?: string;
};

export function Dialog({
  open,
  onClose,
  title,
  closeLabel,
  initialFocusRef,
  children,
  note,
  actions,
  className = '',
}: DialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        if (document.activeElement instanceof HTMLElement) {
          previouslyFocusedElementRef.current = document.activeElement;
        }
        dialog.showModal();
        initialFocusRef?.current?.focus();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus();
        previouslyFocusedElementRef.current = null;
      }
    }
  }, [open, initialFocusRef]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus();
        previouslyFocusedElementRef.current = null;
      }
      onClose?.();
    };
    // `Esc` cannot close a dialog whose request is running.
    const handleCancel = (event: Event) => {
      if (onClose === undefined) event.preventDefault();
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === dialogRef.current) {
      onClose?.();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={cx(
        'bg-bg-raised border-line text-fur animate-reveal backdrop:bg-scrim m-auto max-h-[calc(100vh-var(--space-16))] w-[calc(100vw-var(--space-8))] max-w-120 overflow-y-auto rounded-md border p-0',
        className,
      )}
      aria-labelledby="dialog-title"
    >
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start justify-between">
          <h2 id="dialog-title" className="text-ui-heading text-fur">
            {title}
          </h2>
          {onClose !== undefined && (
            <button
              type="button"
              onClick={onClose}
              className="text-fur-dim hover:text-fur hover:bg-bg-hover pointer-coarse:min-h-touch-min pointer-coarse:min-w-touch-min h-control-sm w-control-sm -mt-1 -mr-2 inline-flex shrink-0 cursor-pointer items-center justify-center rounded-sm font-mono transition-colors"
              aria-label={closeLabel}
            >
              ✕
            </button>
          )}
        </div>
        <div className="flex flex-col gap-4">{children}</div>
        {actions !== undefined && (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {note !== undefined && (
              <div className="flex min-h-10 min-w-0 flex-[1_1_0] items-center max-sm:basis-full">
                {note}
              </div>
            )}
            {actions}
          </div>
        )}
      </div>
    </dialog>
  );
}
