import type { ComponentChildren, JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { cx, useMediaQuery } from '../lib';
import { Button } from './button';
import { Kbd } from './kbd';
import { createTaskController } from './task-controller';
import type { TaskController, TaskKind } from './task-controller';

export type TaskSession = {
  readonly kind: 'learning' | 'review';
  // The task on display, from 1; it grows after every task, introductions included.
  readonly n: number;
  readonly total: number;
};

// Every string the task shows, from the caller's dictionary.
export type TaskLabels = {
  readonly learning: string;
  readonly review: string;
  readonly of: string;
  readonly newKana: string;
  readonly show: string;
  readonly blur: string;
  readonly focus: string;
  readonly leave: string;
  // The name of the Esc key in the hint.
  readonly esc: string;
  // The name of the group of options.
  readonly options: string;
};

export type KanaTaskProps = {
  readonly kind: TaskKind;
  // Introduction, recall.
  readonly kana?: string;
  // Introduction: the hint under the kana. Recognition: the prompt.
  readonly romaji?: string;
  readonly session: TaskSession;
  // The content of the reserved notice line.
  readonly notice?: ComponentChildren;
  // Recognition: the four options.
  readonly children?: ComponentChildren;
  readonly labels: TaskLabels;
  readonly onLeave?: () => void;
  // Recall under a touch screen, which has no Esc: the "show the romaji" button.
  readonly onShow?: () => void;
  // Called with the controller when the task is on screen, once per task.
  readonly onReady?: (controller: TaskController) => void;
  // Forces the touch layout; the default follows `(pointer: coarse)`.
  readonly coarse?: boolean;
};

/**
 * One task of a learning or review session: the session line, the prompt, the options, the
 * notice line and the hint line. It renders once per task; keystrokes go to the controller
 * (`onReady`), which writes classes, text and transforms. Everything shown comes through props.
 */
export function KanaTask({
  kind,
  kana,
  romaji,
  session,
  notice,
  children,
  labels,
  onLeave,
  onShow,
  onReady,
  coarse,
}: KanaTaskProps): JSX.Element {
  const narrow = useMediaQuery('(max-width: 639px)');
  const touch = useMediaQuery('(pointer: coarse)');
  const isCoarse = coarse ?? touch;
  const root = useRef<HTMLElement>(null);
  const ready = useRef(onReady);
  ready.current = onReady;

  useLayoutEffect(() => {
    if (root.current === null) return undefined;
    const controller = createTaskController(root.current);
    ready.current?.(controller);
    return () => {
      controller.destroy();
    };
  }, [kind, kana, romaji, narrow]);

  const solo = narrow ? 'text-jp-solo-sm' : 'text-jp-solo';
  const caret = (
    <span data-task-caret className="nk-caret" aria-hidden="true">
      <span data-task-flash className="nk-caret__reject" />
    </span>
  );

  return (
    <section
      ref={root}
      data-testid="kana-task"
      data-kind={kind}
      className={cx('nk-task', `nk-task--${kind}`, isCoarse && 'is-coarse')}
    >
      <div className="nk-task__bar text-mono-small font-mono">
        <span data-testid="task-session">
          <span>{labels[session.kind]} · </span>
          <span className="nk-task__n">{session.n}</span>
          {` ${labels.of} `}
          <span className="nk-task__n">{session.total}</span>
        </span>
        {onLeave !== undefined && (
          <Button variant="text" size="sm" className="nk-task__leave" onClick={onLeave}>
            {labels.leave}
          </Button>
        )}
      </div>
      <div data-task-stage className="nk-task__stage">
        {kind === 'introduction' && (
          <>
            <span className="nk-task__label text-ui-caption">{labels.newKana}</span>
            <span data-task-kana className={cx('nk-task__kana font-jp', solo)} lang="ja">
              {kana}
            </span>
            <span className="nk-task__ghost text-mono-counter font-mono" aria-label={romaji}>
              {Array.from(romaji ?? '').map((letter, i) => (
                <span key={i} data-task-letter className="nk-task__letter" aria-hidden="true">
                  {letter}
                </span>
              ))}
              {caret}
            </span>
          </>
        )}
        {kind === 'recall' && (
          <span className={cx('nk-task__line', narrow ? 'is-narrow' : 'is-wide')}>
            <span data-task-kana className={cx('nk-task__kana font-jp', solo)} lang="ja">
              {kana}
            </span>
            {caret}
            <span
              data-task-buffer
              className={cx(
                'nk-task__buffer font-mono',
                narrow ? 'text-mono-small' : 'text-mono-romaji',
              )}
              aria-hidden="true"
            />
          </span>
        )}
        {kind === 'recognition' && (
          <span
            data-testid="task-prompt"
            className={cx(
              'nk-task__romaji font-mono',
              narrow ? 'text-mono-hero-sm' : 'text-mono-hero',
            )}
          >
            {romaji}
          </span>
        )}
      </div>
      {kind === 'recognition' && (
        <div className="nk-task__options" role="group" aria-label={labels.options}>
          {children}
        </div>
      )}
      <div className="nk-task__blur text-ui-label" aria-hidden="true">
        {labels.blur}
      </div>
      <div className="nk-task__notice">{notice}</div>
      <div className="nk-task__foot text-ui-caption">
        {kind === 'recall' &&
          (isCoarse ? (
            <Button
              variant="text"
              size="sm"
              className="nk-task__show"
              onClick={() => {
                onShow?.();
              }}
            >
              {labels.show}
            </Button>
          ) : (
            <span className="nk-task__hint">
              <Kbd>{labels.esc}</Kbd> {labels.show}
            </span>
          ))}
        <span className="nk-task__focus" aria-live="polite">
          {labels.focus}
        </span>
      </div>
    </section>
  );
}
