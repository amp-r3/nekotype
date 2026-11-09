import type { JSX } from 'preact';
import type { TranslationPart } from '@/shared/i18n';

export type PartsProps = {
  readonly parts: readonly TranslationPart[];
  // The classes of the values (numbers in the mono face, kana in the Japanese one).
  readonly valueClass: string;
  readonly lang?: string;
};

/** A translated line (`tParts`) with its values set apart from the words around them. */
export function Parts({ parts, valueClass, lang }: PartsProps): JSX.Element {
  return (
    <>
      {parts.map((part, at) =>
        part.param ? (
          <span key={at} className={valueClass} lang={lang}>
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
