import type { JSX } from 'preact';
import { useComputed } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import { t } from '@/shared/i18n';
import { isApplePlatform, useMediaQuery } from '@/shared/lib';
import { testConfig, showTranslationSetting } from '@/entities/settings';
import { Kbd, RefreshIcon, Button } from '@/shared/ui';
import type { Session } from '@/features/training';
import { TextStream, useTestChrome, useFinishButton } from '@/features/training';
import type { TestInput } from '@/features/training';
import { LiveLine } from './live-line';

export type TestStageProps = {
  readonly session: Session;
  /** Whether the test is a repeat (the live line marks it). */
  readonly repeating: ReadonlySignal<boolean>;
  /** The hidden field of the page and its focus (the page owns it, see `useTestInput`). */
  readonly input: TestInput;
  /** Restarts and gives the keyboard back to the field, both inside the click. */
  readonly onRestart: () => void;
};

/**
 * The test screen: the live line, the stream, the hints with Restart, the translation and one
 * line for notices, in the order of the design. Nothing here reads a signal that a keystroke changes
 * while rendering: the lines of text below are signals passed as text nodes, and the stream writes
 * itself (docs/spec/frontend.md, "Hot path"). So a keystroke renders no component, and a completed
 * prompt renders only the stream.
 */
export function TestStage({ session, repeating, input, onRestart }: TestStageProps): JSX.Element {
  const { source, stageRef, focusInput } = input;
  const finishRef = useFinishButton(session);

  useTestChrome(session);

  const zen = testConfig.value.kind === 'zen';
  // A touch screen has no Esc: a button stands in its place (docs/spec/frontend.md, "Keyboard").
  const touch = useMediaQuery('(pointer: coarse)');

  // These lines take their place before they have text, so the stream does not move when they get
  // some.
  const notice = useComputed(() =>
    source.layoutNotice.value
      ? t('stage.switchLayout')
      : source.imeNotice.value
        ? t('stage.turnImeOff')
        : '',
  );
  const revealed = useComputed(() =>
    session.isAssisted.value ? t('stage.revealed', { answer: session.canonicalRomaji.value }) : '',
  );
  const translation = useComputed(() => {
    const meaning = session.currentPrompt.value?.meaning;
    if (meaning === undefined || !showTranslationSetting.value) return '';
    // English in both locales: the translations come from Tatoeba and JMdict (content.md).
    return meaning.en;
  });
  // The Tatoeba licence wants the author credited, so the link stays when the translation is off.
  const sourceHref = useComputed(() => {
    const id = session.currentPrompt.value?.tatoebaId;
    return id === undefined ? '' : `https://tatoeba.org/sentences/${id}`;
  });
  const sourceHidden = useComputed(() => sourceHref.value === '');

  return (
    <div
      ref={stageRef}
      data-input-focused="true"
      onClick={focusInput}
      className="nk-stage max-w-layout-test mx-auto flex w-full cursor-text flex-col gap-4 py-8 outline-none select-none"
    >
      <LiveLine session={session} repeating={repeating} />

      <TextStream session={session} />

      <div className="text-fur-dim text-ui-caption flex w-full flex-wrap items-center justify-between gap-3">
        {touch ? (
          <Button
            variant="text"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              // Inside the click, so the keyboard of a phone stays open.
              focusInput();
              session.handleIntent({ kind: 'reveal' });
            }}
          >
            {t('stage.showRomaji')}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Kbd>{t('key.esc')}</Kbd>
            <span>{t('stage.escHint')}</span>
          </div>
        )}

        <span
          aria-hidden="true"
          className="nk-focus-hint text-ui-caption pointer-events-none px-3 py-1"
        >
          {t('stage.clickToFocus')}
        </span>

        {/* Restart is the first control after the hidden field, before the source link of a phrase:
            the first Tab reaches it in every mode (design TestScreen order). */}
        <div className="flex items-center gap-2">
          <Button
            variant="text"
            size="sm"
            onClick={(e) => {
              // The click is dealt with here; the stage would only focus the field a second time.
              e.stopPropagation();
              onRestart();
            }}
            className="nk-on-focus flex items-center gap-1.5"
            ariaLabel={t('stage.restartLabel')}
          >
            <RefreshIcon size={13} />
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <Kbd>{t('key.tabEnter')}</Kbd>
              {t('stage.tabHint')}
            </span>
            <span className="sm:hidden">{t('stage.restart')}</span>
          </Button>

          {zen && (
            <Button
              variant="secondary"
              size="sm"
              buttonRef={finishRef}
              disabled
              onClick={(e) => {
                e.stopPropagation();
                // A finish with nothing to keep is dropped and leaves no screen to take the focus.
                focusInput();
                session.finish();
              }}
              className="flex items-center gap-2"
            >
              {t('stage.finish')}
              <Kbd>{isApplePlatform() ? t('key.cmdEnter') : t('key.ctrlEnter')}</Kbd>
            </Button>
          )}
        </div>
      </div>

      {/* Two lines are reserved, so a long translation or the link does not move the stream. */}
      <div className="text-fur-dim flex min-h-12 flex-wrap items-baseline justify-center gap-x-4 gap-y-1 text-center">
        <p data-testid="translation" className="text-ui-body m-0 flex-[1_1_320px]">
          {translation}
        </p>
        <a
          data-testid="source-link"
          href={sourceHref}
          hidden={sourceHidden}
          target="_blank"
          rel="noopener"
          // A press on the link must not move the keyboard out of the hidden field.
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          className="text-ui-caption hover:text-fur underline"
        >
          {t('stage.source')}
        </a>
      </div>

      <div className="flex min-h-7 w-full items-center justify-center gap-3 text-center">
        <span role="status" className="text-fur-dim text-ui-label">
          {notice}
        </span>
        <span className="text-eye text-mono-romaji font-mono">{revealed}</span>
      </div>
    </div>
  );
}
