import { createBaseConfig } from '../../eslint.base.js';

// The package is not Feature-Sliced; its layers (routes → auth, db, sync → lib) are enforced here
// as the plan's D1 lays out. No layer exists yet beyond `lib`.
const restricted = (from, ...forbidden) => ({
  files: [`src/${from}/**/*.ts`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@nekotype/web', '@nekotype/content', '@nekotype/engine'],
            message: 'apps/api must not import the web app, the content build or the engine.',
          },
          ...forbidden.map((layer) => ({
            group: [`../${layer}`, `../${layer}/*`],
            message: `src/${from} must not import src/${layer}.`,
          })),
        ],
      },
    ],
  },
});

export default [
  ...createBaseConfig(import.meta.dirname),
  {
    files: ['src/**/*.ts'],
    rules: {
      // `createApp(_deps)` takes its dependencies before the first route uses them (PR 3).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nekotype/web', '@nekotype/content', '@nekotype/engine'],
              message: 'apps/api must not import the web app, the content build or the engine.',
            },
          ],
        },
      ],
    },
  },
  restricted('lib', 'routes', 'auth', 'db', 'sync'),
  restricted('db', 'routes', 'auth', 'sync'),
  restricted('auth', 'routes', 'sync'),
  restricted('sync', 'routes', 'auth'),
];
