import tseslint from 'typescript-eslint';

export function createBaseConfig(tsconfigRootDir) {
  return tseslint.config(
    {
      ignores: [
        'dist/**',
        'dist-probe/**',
        'dist-e2e/**',
        'dist-e2e-sync/**',
        'node_modules/**',
        'coverage/**',
        'scripts/font-src/**',
        'src/assets/fonts/**',
      ],
    },
    {
      files: ['src/**/*.{ts,tsx}'],
      extends: [...tseslint.configs.strictTypeChecked],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      linterOptions: {
        noInlineConfig: true,
        reportUnusedDisableDirectives: 'error',
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/ban-ts-comment': 'error',
        '@typescript-eslint/consistent-type-assertions': [
          'error',
          {
            assertionStyle: 'never',
          },
        ],
        '@typescript-eslint/no-non-null-assertion': 'error',
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {
            prefer: 'type-imports',
          },
        ],
        '@typescript-eslint/no-unnecessary-condition': 'error',
        '@typescript-eslint/restrict-template-expressions': [
          'error',
          {
            allowNumber: true,
          },
        ],
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
        ],
      },
    },
    {
      files: ['**/*.config.*', 'scripts/**/*'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
  );
}
