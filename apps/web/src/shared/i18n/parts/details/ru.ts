import type { detailsEn } from './en';

export const detailsRu = {
  'details.close': 'закрыть',
  'details.row.state': 'состояние',
  'details.row.memory': 'память',
  'details.row.recall': 'вспоминание',
  'details.row.mixups': 'путали с',
  'details.row.recognition': 'узнавание',
  'details.due': 'пора повторить',
  'details.nextReview': 'повторение: {date}',
  'details.holds.one': 'держится около {count} дня',
  'details.holds.few': 'держится около {count} дней',
  'details.holds.many': 'держится около {count} дней',
  'details.holds.other': 'держится около {count} дня',
  'details.holdsLess': 'держится меньше дня',
  'details.masteredFrom': 'освоена — от {days} дня',
  'details.stats': 'медиана {ms} мс · точность {accuracy}%',
  'details.answers': '{n} из 10 ответов',
  'details.noRecall': 'ответов на вспоминание пока нет',
  'details.none': 'пока нет',
  'details.recognition': '{accuracy}% ({ok} из {total})',
  'details.noRecognition': 'ответов пока нет',
} as const satisfies Record<keyof typeof detailsEn, string>;
