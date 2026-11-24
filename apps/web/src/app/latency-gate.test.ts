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
      'apps/web/src/pages/learn/model/session.ts',
      'apps/web/src/pages/learn/ui/session-screen.tsx',
      'apps/web/src/shared/ui/kana-task.tsx',
      'apps/web/src/shared/ui/task-controller.ts',
      'apps/web/src/pages/learn/lib/prompt/engine.ts',
      'apps/web/src/shared/i18n/dictionary.ts',
      'apps/web/src/app/prefetch.ts',
      'apps/web/vite.config.ts',
      'apps/web/e2e/latency.spec.ts',
      'apps/web/e2e/model-cost.spec.ts',
      'apps/web/src/app/model-probe.ts',
      'apps/web/scripts/latency-gate.mjs',
      'apps/web/scripts/latency-gate.d.mts',
      'packages/engine/src/matcher/compile.ts',
      'packages/model/src/fold.ts',
      'packages/model/src/testing/synthetic-log.ts',
      'pnpm-lock.yaml',
    ]) {
      expect(latencyRelevant([file]), file).toEqual([file]);
    }
  });

  it('is not needed for screens off the recall path, translations, shared UI, tests, styles or documents', () => {
    expect(
      latencyRelevant([
        'apps/web/src/pages/learn/ui/session-screen.test.tsx',
        'apps/web/src/pages/learn/ui/session-screen.css',
        'apps/web/src/shared/ui/button.tsx',
        'apps/web/src/shared/i18n/parts/progress/en.ts',
        'apps/web/src/shared/i18n/en.ts',
        'apps/web/src/app/styles/index.css',
        'apps/web/src/app/App.test.tsx',
        'apps/web/src/pages/learn/lib/prompt/canonical.test.ts',
        'packages/engine/README.md',
        'packages/model/src/fold.test.ts',
        'packages/model/README.md',
        'apps/web/src/pages/progress/ui/progress-page.tsx',
        'apps/web/src/pages/about/ui/about-page.tsx',
        'apps/web/src/pages/settings/ui/settings-page.tsx',
        'apps/web/src/features/sync/model/engine.ts',
        'packages/content/src/words.ts',
        'packages/shared/src/sync-runtime.ts',
        'docs/spec/metrics.md',
        'README.md',
      ]),
    ).toEqual([]);
  });

  it('is needed when any one file of a mixed change is relevant', () => {
    expect(
      latencyRelevant(['docs/a.md', 'apps/web/src/pages/learn/ui/session-screen.tsx']),
    ).toEqual(['apps/web/src/pages/learn/ui/session-screen.tsx']);
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
    // The `scope` job decides (it has the whole history), the `latency` job runs (ADR 098).
    expect(workflow).toContain("|| steps.latency.outputs.needed || 'true'");
    expect(workflow).toContain("needs.scope.outputs.latency == 'true'");
    expect(workflow).toContain('fetch-depth: 0');
  });
});
