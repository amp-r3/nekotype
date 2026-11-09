import type { JSX } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { RefObject } from 'preact';
import { useComputed, useSignalEffect } from '@preact/signals';
import { t } from '@/shared/i18n';
import { setImmersive, useMediaQuery } from '@/shared/lib';
import { Button, Kbd } from '@/shared/ui';
import { KanaTask } from '@/shared/ui/kana-task';
import type { TaskLabels } from '@/shared/ui/kana-task';
import { OptionCard } from '@/shared/ui/option-card';
import type { OptionState } from '@/shared/ui/option-card';
import type { LearnKanaKey } from '@nekotype/shared/types';
import { useSessionInput } from '../lib/use-session-input';
import type { LearnSession, Notice, TaskView } from '../model/session';

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
    // The hint to go on is drawn by the screen itself (a key and a word, or a button on touch).
    case 'next':
    case 'none':
      return '';
  }
}

// What a screen reader hears when a new task appears.
function announce(task: TaskView): string {
  switch (task.kind) {
    case 'introduction':
      return t('learn.session.ask.introduction', { kana: task.kana, romaji: task.romaji });
    case 'recall':
      return t('learn.session.ask.recall', { kana: task.kana });
    case 'recognition':
      return t('learn.session.ask.recognition', { romaji: task.romaji });
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
  const { source, onReady } = useSessionInput(session, inputRef);
  // A wrong layout or an IME beats the notice of the session, as on /type.
  const notice = useComputed(() =>
    source.layoutNotice.value
      ? t('stage.switchLayout')
      : source.imeNotice.value
        ? t('stage.turnImeOff')
        : noticeText(session.notice.value),
  );
  const live = useRef<HTMLParagraphElement>(null);
  const coarse = useMediaQuery('(pointer: coarse)');

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

  useEffect(() => {
    if (live.current !== null && task !== null) live.current.textContent = announce(task);
  }, [task]);

  if (task === null) return null;

  const optionState = (key: LearnKanaKey): OptionState => {
    if (choice === null) return 'idle';
    if (key === choice.chosen) return choice.correct ? 'correct' : 'wrong';
    return key === task.key && !choice.correct ? 'reveal' : 'idle';
  };

  // After a wrong choice the next task waits: Enter, Space or a click go on. The hint is a key and a
  // word, and on a touch screen, which has no Enter, a button.
  const waiting = choice !== null && !choice.correct;
  const answer = (
    <span className="sr-only">{t('learn.session.answer', { kana: kanaOfKey(task.key) })}</span>
  );
  const goOn = coarse ? (
    <span role="status" className="inline-flex items-center gap-2">
      <Button variant="text" size="sm" className="nk-task__next" onClick={session.advance}>
        {t('learn.session.next')}
      </Button>
      {answer}
    </span>
  ) : (
    <span role="status" className="inline-flex items-center gap-2">
      <Kbd>{t('key.enter')}</Kbd>
      {t('learn.session.next')}
      {answer}
    </span>
  );

  const labelProp = (key: LearnKanaKey): { ariaLabel?: string } => {
    const state = optionState(key);
    const kana = kanaOfKey(key);
    switch (state) {
      case 'correct':
        return { ariaLabel: t('learn.option.correct', { kana }) };
      case 'wrong':
        return { ariaLabel: t('learn.option.wrong', { kana }) };
      case 'reveal':
        return { ariaLabel: t('learn.option.reveal', { kana }) };
      case 'idle':
        return {};
    }
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
      onMouseDown={(event) => {
        // The buttons of the task must not take the focus from the field: a phone keeps its keyboard.
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest('.nk-opt, .nk-task__show, .nk-task__next') !== null
        ) {
          event.preventDefault();
        }
      }}
      onClick={(event) => {
        // The options and the buttons of the task act for themselves.
        const target = event.target;
        if (target instanceof Element && target.closest('.nk-task__leave') !== null) return;
        if (
          target instanceof Element &&
          target.closest('.nk-opt, .nk-task__show, .nk-task__next') !== null
        ) {
          inputRef.current?.focus({ preventScroll: true });
          return;
        }
        if (session.phase.value === 'waiting') session.advance();
        else inputRef.current?.focus();
      }}
    >
      <p ref={live} className="sr-only" aria-live="polite" />
      <KanaTask
        kind={task.kind}
        {...shown}
        session={{ kind: session.mode, n: task.n, total: session.total }}
        labels={labels()}
        notice={waiting ? goOn : <span role="status">{notice}</span>}
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
              {...labelProp(option)}
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
