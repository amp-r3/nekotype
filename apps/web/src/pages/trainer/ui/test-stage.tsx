import type { JSX } from 'preact';
import { useComputed } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import { t } from '@/shared/i18n';
import { isApplePlatform, useMediaQuery } from '@/shared/lib';
import { testConfig, showTranslationSetting } from '@/entities/settings';
import { Kbd, RestartIcon, Button, Notice } from '@/shared/ui';
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
  // The lead and the romaji are two signals, so the revealed answer is a text node as well. The
  // lead ends in a space: the gap between the two is layout, and the text reads as one phrase.
  const revealLead = useComputed(() => (session.isAssisted.value ? `${t('stage.revealed')} ` : ''));
  const revealed = useComputed(() =>
    session.isAssisted.value ? session.canonicalRomaji.value : '',
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
      className="nk-stage max-w-layout-test mx-auto flex w-full cursor-text flex-col gap-4 pb-8 outline-none select-none"
    >
      <LiveLine session={session} repeating={repeating} />

      <TextStream session={session} />

      <div className="text-fur-dim text-ui-caption flex min-h-5 w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {touch ? (
          <Button
            variant="text"
            size="sm"
            className="-ml-2"
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
            <span>{t('stage.showRomaji')}</span>
          </div>
        )}

        <span aria-hidden="true" className="nk-focus-hint text-ui-caption pointer-events-none">
          {t('stage.clickToFocus')}
        </span>
      </div>

      {/* Restart is the first control after the hidden field, before the source link of a phrase:
          the first Tab reaches it in every mode (design TestScreen order). */}
      <div className="flex items-center gap-2">
        <Button
          variant="text"
          size="md"
          onClick={(e) => {
            // The click is dealt with here; the stage would only focus the field a second time.
            e.stopPropagation();
            onRestart();
          }}
          className="nk-on-focus"
          ariaLabel={t('stage.restartLabel')}
        >
          <RestartIcon />
          <span className="hidden items-baseline gap-1 sm:inline-flex">
            <Kbd bare>{t('key.tab')}</Kbd>
            <span aria-hidden="true">→</span>
            <Kbd bare>{t('key.enter')}</Kbd>
            <span aria-hidden="true">—</span>
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
            hint={isApplePlatform() ? t('key.cmdEnter') : t('key.ctrlEnter')}
          >
            {t('stage.finish')}
          </Button>
        )}
      </div>

      {/* Two lines are reserved, so a long translation or the link does not move the stream. */}
      <div className="text-fur-dim flex min-h-12 flex-wrap items-baseline gap-x-4 gap-y-1">
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
          className="text-ui-caption hover:text-fur decoration-line-strong hover:decoration-fur-dim underline underline-offset-[3px] transition-colors"
        >
          {t('stage.source')}
        </a>
      </div>

      <div className="flex min-h-5 w-full items-baseline gap-3">
        <span role="status" className="text-fur-dim text-ui-label">
          {notice}
        </span>
        <Notice lead={revealLead}>{revealed}</Notice>
      </div>
    </div>
  );
}
