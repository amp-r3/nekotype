import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LATENCY_PATHS, latencyRelevant } from '../../scripts/latency-gate.mjs';

const repoRoot = join(import.meta.dirname, '../../../..');

describe('latency gate on pull requests (ADR 074)', () => {
  it('is needed for what can move keystroke latency', () => {
    for (const file of [
      'apps/web/src/shared/lib/input/input-source.ts',
      'apps/web/src/features/training/model/session.ts',
      'apps/web/src/entities/prompt/api/content-loader.ts',
      'apps/web/src/entities/prompt/content/words-hiragana.json',
      'apps/web/src/shared/i18n/dictionary.ts',
      'apps/web/src/pages/trainer/ui/test-stage.tsx',
      'apps/web/src/app/prefetch.ts',
      'apps/web/vite.config.ts',
      'apps/web/e2e/latency.spec.ts',
      'apps/web/scripts/latency-gate.mjs',
      'apps/web/scripts/latency-gate.d.mts',
      'packages/engine/src/matcher/compile.ts',
      'pnpm-lock.yaml',
    ]) {
      expect(latencyRelevant([file]), file).toEqual([file]);
    }
  });

  it('is not needed for screens off the typing path, translations, shared UI, tests, styles or documents', () => {
    expect(
      latencyRelevant([
        'apps/web/src/pages/learn/ui/session-screen.tsx',
        'apps/web/src/pages/trainer/ui/results-panel.tsx',
        'apps/web/src/shared/ui/button.tsx',
        'apps/web/src/shared/i18n/parts/type/en.ts',
        'apps/web/src/shared/i18n/en.ts',
        'apps/web/src/app/styles/index.css',
        'apps/web/src/app/App.test.tsx',
        'apps/web/src/features/training/model/session.test.ts',
        'apps/web/src/entities/prompt/lib/picker.test.ts',
        'packages/engine/README.md',
        'apps/web/src/pages/stats/ui/stats-page.tsx',
        'apps/web/src/pages/about/ui/about-page.tsx',
        'apps/web/src/pages/settings/ui/settings-page.tsx',
        'apps/web/src/entities/stats/model/store.ts',
        'packages/content/src/words.ts',
        'packages/shared/src/typing-runtime.ts',
        'docs/spec/metrics.md',
        'README.md',
      ]),
    ).toEqual([]);
  });

  it('is needed when any one file of a mixed change is relevant', () => {
    expect(latencyRelevant(['docs/a.md', 'apps/web/src/pages/trainer/ui/live-line.tsx'])).toEqual([
      'apps/web/src/pages/trainer/ui/live-line.tsx',
    ]);
  });

  it('lists only paths that exist', () => {
    for (const prefix of LATENCY_PATHS) {
      expect(
        execFileSync('git', ['ls-files', prefix], { cwd: repoRoot, encoding: 'utf8' }).trim(),
        prefix,
      ).not.toBe('');
    }
  });

  it('is wired into the workflow: a pull request runs the gate when the script says so', () => {
    const workflow = readFileSync(join(repoRoot, '.github/workflows/deploy.yml'), 'utf-8');
    expect(workflow).toContain('node apps/web/scripts/latency-gate.mjs HEAD^1 HEAD');
    expect(workflow).toContain("steps.latency.outputs.needed == 'true'");
    expect(workflow).toContain("fetch-depth: ${{ github.event_name == 'pull_request' && 2 || 1 }}");
  });
});
