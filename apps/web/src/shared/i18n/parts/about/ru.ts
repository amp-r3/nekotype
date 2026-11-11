import type { aboutEn } from './en';

export const aboutRu = {
  'page.stub': 'Этот экран ещё не готов.',
} as const satisfies Record<keyof typeof aboutEn, string>;
