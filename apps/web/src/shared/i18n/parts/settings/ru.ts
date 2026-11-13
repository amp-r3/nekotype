import type { settingsEn } from './en';

export const settingsRu = {
  'settings.reset.description': 'Стирает прогресс обучения и статистику набора в этом браузере.',

  'settings.learn.title': 'Обучение',
  'settings.learn.strictness': 'строгость в обучении',
  'settings.learn.strictnessHint': 'Мягкая также принимает «si» для し и «tu» для つ.',
  'settings.learn.relaxed': 'мягкая',
  'settings.learn.strictIme': 'строгая IME',
  'settings.learn.target': 'целевое время ответа',
  'settings.learn.targetHint':
    'При меньшей цели каны позже становятся уверенными, а уверенные могут это утратить.',
  'settings.learn.targetValue': '{ms} мс',
  'settings.typing.title': 'Набор',
  'settings.showTranslation': 'перевод под текстом',
  'settings.showTranslationHint': 'Перевод слова или фразы под текстом теста.',
  'settings.data.title': 'Данные',
  'settings.data.reset': 'сбросить прогресс',
  'settings.data.resetAction': 'сбросить',

  'dialog.close': 'закрыть',
  'reset.title': 'Сбросить прогресс?',
  'reset.confirm':
    'Прогресс обучения и статистика набора в этом браузере будут стёрты. Это нельзя отменить.',
  'reset.action': 'сбросить',
  'reset.cancel': 'отмена',
} as const satisfies Record<keyof typeof settingsEn, string>;
