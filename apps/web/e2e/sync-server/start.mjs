// The web server of playwright.sync.config.ts: builds the application into `dist-e2e-sync`, applies
// the D1 migrations to a database in a fresh temporary directory, and serves both with
// `wrangler pages dev` on the port in E2E_SYNC_PORT (p5-plan.md, D9). The temporary directory is
// removed when the server stops.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = fileURLToPath(new URL('.', import.meta.url));
const webDir = join(serverDir, '..', '..');
const port = process.env['E2E_SYNC_PORT'] ?? '5274';
// `pnpm exec` started in this folder would run from the workspace root and make wrangler read the
// root `wrangler.toml`; the binary is started here directly, so it reads the one next to this file.
const wrangler = join(webDir, '..', '..', 'node_modules', '.bin', 'wrangler');
const state = mkdtempSync(join(tmpdir(), 'nekotype-e2e-sync-'));
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: process.env['CI'] ?? '1' };

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) {
    rmSync(state, { recursive: true, force: true });
    process.exit(result.status ?? 1);
  }
}

run('pnpm', ['exec', 'vite', 'build', '--outDir', 'dist-e2e-sync', '--emptyOutDir'], webDir);
run(wrangler, ['d1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state], serverDir);

const server = spawn(wrangler, ['pages', 'dev', '--port', port, '--persist-to', state], {
  cwd: serverDir,
  env,
  stdio: 'inherit',
});

function stop() {
  server.kill('SIGTERM');
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
server.on('exit', (code) => {
  rmSync(state, { recursive: true, force: true });
  process.exit(code ?? 0);
});
