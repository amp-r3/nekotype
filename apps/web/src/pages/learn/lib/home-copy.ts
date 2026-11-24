import type { Outline, Reason, RowId } from '@nekotype/model';
import type { Track } from '@nekotype/shared/types';
import { locale, t, tPluralParts } from '@/shared/i18n';
import type { TranslationPart } from '@/shared/i18n';
import { headOfRow, localDay, trackOfKey } from '@/entities/learn';

// The words of the learning home (P8 plan, D1, D7; design decisions 140–145). Pure functions of the
// data and the language: the views only lay them out.

export const kanaOfKey = (key: string): string => key.slice(key.indexOf(':') + 1);

/** The name of a row: `the vowels`, `the k row`. */
export function rowLabel(row: RowId): string {
  const head = headOfRow(row);
  return head === '' ? t('learn.row.vowels') : t('learn.row.of', { head });
}

/** The weak kana of a reason as one string, in the order of the reason. */
export function weakKana(reason: Extract<Reason, { kind: 'weak' }>): string {
  return reason.keys.map(kanaOfKey).join(' ');
}

/** The reason as the pieces of one line; the parameters (counts and kana) are the values. */
export function reasonParts(reason: Reason, track: Track): readonly TranslationPart[] {
  switch (reason.kind) {
    case 'review':
      return tPluralParts('learn.reason.review', reason.due);
    case 'weak':
      return tPluralParts('learn.reason.weak', reason.keys.length, { kana: weakKana(reason) });
    case 'learning':
      return tPluralParts('learn.reason.learning', reason.learning);
    case 'new': {
      const row = rowLabel(reason.row);
      const own = reason.row.startsWith(`${track}:`);
      const text = own
        ? t('learn.reason.new', { row })
        : t('learn.reason.newOther', { row, track: t(`learn.track.${trackOfKey(reason.key)}`) });
      return [{ text, param: false }];
    }
    case 'none':
      return [{ text: t('learn.reason.none'), param: false }];
  }
}

/** When the next review comes: `at 18:40` today, `tomorrow at 9:15`, `12 Nov, 9:15` later. */
export function whenOf(at: number, now: number): string {
  const time = new Intl.DateTimeFormat(locale.value, { hour: 'numeric', minute: '2-digit' }).format(
    at,
  );
  const days = localDay(at) - localDay(now);
  if (days <= 0) return t('learn.when.today', { time });
  if (days === 1) return t('learn.when.tomorrow', { time });
  const date = new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(at);
  return t('learn.when.later', { date, time });
}

/** The outline of a session: `about 30 tasks: 6 reviews, 2 new kana`; a part at 0 is left out. */
export function outlineParts(outline: Outline): readonly TranslationPart[] {
  const total = outline.reviews + outline.learning + outline.introductions;
  const listed: (readonly TranslationPart[])[] = [];
  if (outline.reviews > 0) listed.push(tPluralParts('learn.outline.reviews', outline.reviews));
  if (outline.introductions > 0) {
    listed.push(tPluralParts('learn.outline.new', outline.introductions));
  }
  const parts: TranslationPart[] = [...tPluralParts('learn.outline.total', total)];
  listed.forEach((piece, at) => {
    parts.push({ text: at === 0 ? ': ' : ', ', param: false }, ...piece);
  });
  return parts;
}
