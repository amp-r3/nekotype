import type { statsEn } from './en';

export const statsRu = {
  'stats.learn.title': 'Обучение',
  'stats.learn.median': 'медиана ответа по дням, мс',
  'stats.learn.medianHint': 'меньше — лучше',
  'stats.learn.noData': 'на этой дорожке пока нет ответов',
  'stats.learn.target': 'цель {ms} мс',
  'stats.learn.tip': '{date} · {ms} мс',
  'stats.learn.tipNone': '{date} · нет ответов',
  'stats.learn.streakCurrent': 'текущая серия',
  'stats.learn.streakBest': 'лучшая серия',
  'stats.learn.days.one': 'день',
  'stats.learn.days.few': 'дня',
  'stats.learn.days.many': 'дней',
  'stats.learn.days.other': 'дня',
  'stats.learn.mastered': 'освоено',
  'stats.learn.trackProgress': '{track} {done} из {total}',
  'stats.counters.title': 'Счётчики',
  'stats.counters.started': 'начато',
  'stats.counters.finished': 'закончено',
  'stats.counters.learning': 'сессии обучения',
  'stats.empty.title': 'Статистики пока нет',
  'stats.empty.text':
    'Выучите первые каны: здесь появятся время ответа, серии и результаты набора.',
  'stats.empty.action': 'к обучению',
} as const satisfies Record<keyof typeof statsEn, string>;
