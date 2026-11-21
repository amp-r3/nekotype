import { createBaseConfig } from '../../eslint.base.js';

const FORBIDDEN_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'setTimeout',
  'setInterval',
  'Date',
];

// The model runs in the browser, in a Worker and in Node: no DOM, storage, network, clock or
// timers, and no packages beyond the engine and the shared types. Time comes as numbers and
// randomness as an `Rng`. Tests may use anything.
export default [
  ...createBaseConfig(import.meta.dirname),
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@nekotype/shared/types',
              allowTypeImports: true,
              message: '@nekotype/model imports only types from @nekotype/shared.',
            },
          ],
          patterns: [
            {
              regex: '^(?!\\.)(?!@nekotype/engine$)(?!@nekotype/shared/types$)',
              message:
                '@nekotype/model imports only relative paths, @nekotype/engine and types of @nekotype/shared/types.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...FORBIDDEN_GLOBALS.map((name) => ({
          name,
          message: '@nekotype/model must not touch browser APIs, the clock or timers.',
        })),
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: '@nekotype/model takes randomness as an Rng.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },
];
