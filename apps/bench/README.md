# @nekotype/bench

Measures what one `POST /api/sync` costs on Cloudflare: the CPU time of the Worker in a cold and a warm isolate, and the rows D1 reads and writes ([ADR 078](../../docs/adr/078-user-stats-targeted-updates.md); phase P5, pull request 1). It is a tool run by hand. It is never deployed to production and has no effect on the client bundle.

The numbers and the verdict are in [docs/research/2026-11-16-p5-sync-cpu.md](../../docs/research/2026-11-16-p5-sync-cpu.md).

## What is here

- `functions/api/sync.ts`: the measured endpoint. `POST` applies a batch, `GET` reads the snapshot; the `meta` of every D1 statement is in the response header `x-bench-meta`.
- `src/apply-batch.ts`: the server side of "Applying a batch" in [backend.md](../../docs/spec/backend.md) with the real merge and patch functions of `@nekotype/shared/runtime`. It leaves out what PR 5 adds: the session, the valibot validation, the rate limit and the version retry.
- `scripts/seed.ts`: resets the remote D1 `nekotype-bench` and writes the year-long row of `generateYear` (`@nekotype/shared/testing`) in chunks, because D1 allows 100 KB per statement.
- `scripts/measure.ts`: checks that the Pages project exists, then, for each kind of request (`learning`, `capped`, `results` and the whole-row `get`), deploys five times, sends one request to each fresh deployment (cold) and 50 more to the last one (warm), reads `cpuTime` from `wrangler pages deployment tail --format json`, and prints the table.

## Setup (once, by the maintainer)

The test project and its database are step M1 of `p5-plan.md`: `wrangler login`, a Pages project `nekotype-bench` (`pages project create … --force`) and a D1 database `nekotype-bench`, whose id is in `wrangler.toml`. Both can be deleted when the phase is closed.

## Run

```bash
pnpm --filter @nekotype/bench run seed                      # reset the row (measure does it too)
pnpm --filter @nekotype/bench run measure --out result.json # about 15 minutes: 20 deployments
```

`measure` deploys only to addresses ending in `nekotype-bench.pages.dev` and stops if wrangler hands the deploy to Workers static assets. Run the scripts from a plain terminal or an agent session; the project has Functions and a `_routes.json`, so it stays on Pages.

`cpuTime` in the tail is a whole number of milliseconds, so the percentiles are coarse; a request that takes under a millisecond reads as 0.
