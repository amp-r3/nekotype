import type { JSX, Ref } from 'preact';
import type { Outline, Reason } from '@nekotype/model';
import type { Track } from '@nekotype/shared/types';
import { t } from '@/shared/i18n';
import { Button, Parts } from '@/shared/ui';
import { Cat } from '@/shared/ui/cat';
import { outlineParts, reasonParts, weakKana, whenOf } from '../../lib/home-copy';

const NUMBERS = 'text-mono-romaji text-fur font-mono';

export type HomeActionProps = {
  /** Null until the store is ready. */
  readonly reason: Reason | null;
  /** Null until the insights have computed it; not shown with nothing to do. */
  readonly outline: Outline | null;
  readonly track: Track;
  readonly canStart: boolean;
  /** The katakana suggestion of D5. */
  readonly suggest: boolean;
  readonly now: number;
  readonly onStart: () => void;
  readonly onSuggest: () => void;
  readonly continueRef: Ref<HTMLButtonElement>;
  readonly suggestRef: Ref<HTMLButtonElement>;
};

// The reason Continue starts with, Continue and the outline of the session; with nothing to do the
// time of the next review, and the katakana suggestion as the primary action when it is shown
// (design decisions 140, 141, 145).
export function HomeAction({
  reason,
  outline,
  track,
  canStart,
  suggest,
  now,
  onStart,
  onSuggest,
  continueRef,
  suggestRef,
}: HomeActionProps): JSX.Element {
  const none = reason?.kind === 'none';
  const outlineLine =
    outline !== null &&
    reason !== null &&
    !none &&
    outline.reviews + outline.learning + outline.introductions > 0
      ? outlineParts(outline)
      : null;

  const suggestion = suggest && (
    <div className="flex flex-col items-start gap-2" data-testid="home-suggest">
      <p className="text-ui-body text-fur-dim">{t('learn.suggest.text')}</p>
      <Button
        variant={none ? 'primary' : 'secondary'}
        size={none ? 'lg' : 'sm'}
        buttonRef={suggestRef}
        onClick={onSuggest}
      >
        {t('learn.suggest.start')}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col items-start gap-4">
      {!none && suggestion}
      {/* Nothing to do: the cat sleeps over the reason (design decision 154). */}
      {none && <Cat mood="sleep" size={96} />}
      {/* The line keeps its height while the store loads, so the button does not jump. */}
      {reason === null ? (
        <p aria-hidden="true" className="min-h-8" />
      ) : (
        <p className="text-ui-title text-fur" data-testid="home-reason" data-kind={reason.kind}>
          {reason.kind === 'weak'
            ? reasonParts(reason, track).map((part, at) =>
                part.param && part.text === weakKana(reason) ? (
                  <span key={at} lang="ja" className="font-jp">
                    {part.text}
                  </span>
                ) : (
                  part.text
                ),
              )
            : reasonParts(reason, track)
                .map((part) => part.text)
                .join('')}
        </p>
      )}
      {reason?.kind === 'none' && (
        <p className="text-ui-body text-fur-dim -mt-2" data-testid="home-next-review">
          {t('learn.nextReview', { when: whenOf(reason.nextAt, now) })}
        </p>
      )}
      {!none && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            variant="primary"
            size="lg"
            disabled={!canStart}
            onClick={onStart}
            hint={t('key.enter')}
            hintClassName="pointer-coarse:hidden"
            buttonRef={continueRef}
          >
            {t('learn.continue')}
          </Button>
          {outlineLine !== null && (
            <p className="text-ui-label text-fur-dim" data-testid="home-outline">
              <Parts parts={outlineLine} valueClass={NUMBERS} />
            </p>
          )}
        </div>
      )}
      {none && suggestion}
    </div>
  );
}
