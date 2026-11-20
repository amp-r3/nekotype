import type { aboutEn } from './en';

export const aboutRu = {
  'about.terms.title': 'Nekotype',
  'about.terms.code': 'код',
  'about.terms.codeHolder': 'Copyright (C) 2026 amp-r3 · исходный код:',
  'about.terms.name': 'название, логотипы и кошка',
  'about.terms.reserved': 'все права защищены',
  'about.terms.fonts': 'шрифты',
} as const satisfies Record<keyof typeof aboutEn, string>;
