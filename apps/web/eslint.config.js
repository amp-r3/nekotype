import boundaries from 'eslint-plugin-boundaries';
import { createBaseConfig } from '../../eslint.base.js';

// Feature-Sliced Design layers are enforced on top of the shared strict base config.
export default [
  ...createBaseConfig(import.meta.dirname),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/elements': [
        {
          type: 'app',
          pattern: 'src/app/**',
          partialMatch: false,
        },
        {
          type: 'pages',
          pattern: 'src/pages/*',
          capture: ['slice'],
        },
        {
          type: 'widgets',
          pattern: 'src/widgets/*',
          capture: ['slice'],
        },
        {
          type: 'features',
          pattern: 'src/features/*',
          capture: ['slice'],
        },
        {
          type: 'entities',
          pattern: 'src/entities/*',
          capture: ['slice'],
        },
        {
          type: 'shared',
          pattern: 'src/shared/**',
          partialMatch: false,
        },
      ],
      'boundaries/include': ['src/**/*'],
    },
    rules: {
      // The client must not bundle valibot schemas, the content build or the API (architecture.md).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nekotype/shared/schemas', '@nekotype/content', '@nekotype/api'],
              message: 'apps/web must not import shared/schemas, content or api.',
            },
            {
              group: ['@nekotype/shared/testing'],
              message: 'shared/testing is test data: import it from test files only.',
            },
          ],
        },
      ],
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: [
                {
                  to: {
                    element: {
                      type: ['app', 'pages', 'widgets', 'features', 'entities', 'shared'],
                    },
                  },
                },
              ],
            },
            {
              from: { element: { type: 'pages' } },
              allow: [
                {
                  to: {
                    element: { type: ['widgets', 'features', 'entities', 'shared'] },
                  },
                },
                {
                  to: {
                    element: {
                      type: 'pages',
                      captured: { slice: '{{from.captured.slice}}' },
                    },
                  },
                },
              ],
            },
            {
              from: { element: { type: 'widgets' } },
              allow: [
                {
                  to: {
                    element: { type: ['features', 'entities', 'shared'] },
                  },
                },
                {
                  to: {
                    element: {
                      type: 'widgets',
                      captured: { slice: '{{from.captured.slice}}' },
                    },
                  },
                },
              ],
            },
            {
              from: { element: { type: 'features' } },
              allow: [
                {
                  to: {
                    element: { type: ['entities', 'shared'] },
                  },
                },
                {
                  to: {
                    element: {
                      type: 'features',
                      captured: { slice: '{{from.captured.slice}}' },
                    },
                  },
                },
              ],
            },
            {
              from: { element: { type: 'entities' } },
              allow: [
                {
                  to: {
                    element: { type: 'shared' },
                  },
                },
                {
                  to: {
                    element: {
                      type: 'entities',
                      captured: { slice: '{{from.captured.slice}}' },
                    },
                  },
                },
              ],
            },
            {
              from: { element: { type: 'shared' } },
              allow: [
                {
                  to: {
                    element: { type: 'shared' },
                  },
                },
              ],
            },
            {
              disallow: [
                {
                  to: {
                    element: {
                      type: ['pages', 'widgets', 'features', 'entities'],
                      captured: { slice: '!{{from.captured.slice}}' },
                    },
                    target: '!index.ts',
                  },
                  message: 'A slice can only be imported via its public index.ts',
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    // All user-visible strings come from shared/i18n (AGENTS.md). `no-restricted-syntax` replaces
    // the base config's list, so the base selectors are repeated here.
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message: 'Export * is forbidden. Use explicit named re-exports.',
        },
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Export default is forbidden except in config files.',
        },
        {
          selector: 'JSXText[value=/\\p{L}/u]',
          message: 'Visible text must come from shared/i18n: use t().',
        },
        {
          selector:
            ':matches(JSXAttribute[name.name="aria-label"], JSXAttribute[name.name="ariaLabel"], JSXAttribute[name.name="title"], JSXAttribute[name.name="alt"]) > Literal',
          message: 'Accessible names must come from shared/i18n: use t().',
        },
      ],
    },
  },
  {
    // Test files may use the generated data of shared/testing.
    files: ['src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nekotype/shared/schemas', '@nekotype/content', '@nekotype/api'],
              message: 'apps/web must not import shared/schemas, content or api.',
            },
          ],
        },
      ],
    },
  },
];
