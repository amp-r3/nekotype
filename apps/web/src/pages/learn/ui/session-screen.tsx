import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';
import { useComputed, useSignalEffect } from '@preact/signals';
import { t } from '@/shared/i18n';
import { setImmersive } from '@/shared/lib';
import { KanaTask } from '@/shared/ui/kana-task';
import type { TaskLabels } from '@/shared/ui/kana-task';
import { OptionCard } from '@/shared/ui/option-card';
import type { OptionState } from '@/shared/ui/option-card';
import type { LearnKanaKey } from '@nekotype/shared/types';
import { useSessionInput } from '../lib/use-session-input';
import type { LearnSession, Notice } from '../model/session';

export type SessionScreenProps = {
  readonly session: LearnSession;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onLeave: () => void;
  /** The last task is answered: the summary is ready. */
  readonly onEnd: () => void;
};

function kanaOfKey(key: LearnKanaKey): string {
  return key.slice(key.indexOf(':') + 1);
}

function noticeText(notice: Notice): string {
  switch (notice.kind) {
    case 'revealed':
      return t('learn.session.revealed', { answer: notice.answer });
    case 'restarted':
      return t('learn.session.restarted');
    case 'next':
      return t('learn.session.next');
    case 'none':
      return '';
  }
}

function labels(): TaskLabels {
  return {
    learning: t('learn.session.learning'),
    review: t('learn.session.review'),
    of: t('learn.session.of'),
    newKana: t('learn.session.newKana'),
    show: t('learn.session.show'),
    blur: t('learn.session.blur'),
    focus: t('learn.session.focus'),
    leave: t('learn.session.leave'),
    esc: t('key.esc'),
    options: t('learn.session.options'),
  };
}

/**
 * One learning session on screen. It renders once per task and once per recognition answer; a
 * recall keystroke goes through the controller of the task and the notice is a text node bound to a
 * signal, so neither renders the screen (docs/spec/frontend.md, "Hot path").
 */
export function SessionScreen({
  session,
  inputRef,
  onLeave,
  onEnd,
}: SessionScreenProps): JSX.Element | null {
  const { onReady } = useSessionInput(session, inputRef);
  const notice = useComputed(() => noticeText(session.notice.value));

  // The page changes view for the end of the session only, not for each of its phases.
  useSignalEffect(() => {
    if (session.phase.value === 'summary') onEnd();
  });

  useEffect(() => {
    setImmersive(true);
    return () => {
      setImmersive(false);
    };
  }, []);

  const task = session.task.value;
  const choice = session.choice.value;
  if (task === null) return null;

  const optionState = (key: LearnKanaKey): OptionState => {
    if (choice === null) return 'idle';
    if (key === choice.chosen) return choice.correct ? 'correct' : 'wrong';
    return key === task.key && !choice.correct ? 'reveal' : 'idle';
  };

  const shown =
    task.kind === 'recognition'
      ? { romaji: task.romaji }
      : task.kind === 'introduction'
        ? { kana: task.kana, romaji: task.romaji }
        : { kana: task.kana };

  return (
    <div
      className="flex flex-1 flex-col"
      onClick={(event) => {
        // The options and the buttons of the task act for themselves.
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest('.nk-opt, .nk-task__leave, .nk-task__show')
        ) {
          return;
        }
        if (session.phase.value === 'waiting') session.advance();
        else inputRef.current?.focus();
      }}
    >
      <KanaTask
        kind={task.kind}
        {...shown}
        session={{ kind: session.mode, n: task.n, total: session.total }}
        labels={labels()}
        notice={<span role="status">{notice}</span>}
        onLeave={onLeave}
        onShow={session.reveal}
        onReady={onReady}
      >
        {task.kind === 'recognition' &&
          task.options.map((option, index) => (
            <OptionCard
              key={option}
              n={index + 1}
              kana
              state={optionState(option)}
              disabled={choice !== null}
              onClick={() => {
                session.choose(index);
              }}
            >
              {kanaOfKey(option)}
            </OptionCard>
          ))}
      </KanaTask>
    </div>
  );
}
