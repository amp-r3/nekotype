# @nekotype/bench

Measures what one `/api/sync` request costs on Cloudflare: the CPU time of the Worker in a cold and a warm isolate, and the rows D1 reads and writes ([ADR 078](../../docs/adr/078-user-stats-targeted-updates.md), [ADR 082](../../docs/adr/082-sync-acknowledgement-without-snapshot.md); phase P5, pull requests 1, 5 and 13). It is a tool run by hand. It is never deployed to production and has no effect on the client bundle.

The numbers and the verdict are in [docs/research/2026-11-16-p5-sync-cpu.md](../../docs/research/2026-11-16-p5-sync-cpu.md). The variants measured after it are in [docs/research/2026-11-16-p5-sync-variants.md](../../docs/research/2026-11-16-p5-sync-variants.md), the real endpoint in [2026-11-18-p5-sync-endpoint.md](../../docs/research/2026-11-18-p5-sync-endpoint.md) (PR 5) and the acceptance measurement that closed the phase in [2026-11-19-p5-acceptance.md](../../docs/research/2026-11-19-p5-acceptance.md) (PR 13).

## What is here

- `functions/api/[[route]].ts`: the real application of `apps/api` (its `pages-entry`), with the database binding wrapped in `countingDb` of the API tests, which puts the number of statements of the request (the session lookup included) and the rows they read and wrote in the response header `x-bench-meta`. Until PR 13 only the statements of `batch()` were counted. Until PR 5 this was a model of the endpoint with variants (`base`, `ack`, `keyed`); the variants are in the git history before PR 5 and their numbers in the research notes.
- `scripts/seed.ts`: resets the remote D1 `nekotype-bench` to the application's migrations and writes a user, a session (the token `measure.ts` sends), a settings row and the year-long row of `generateYear` (`@nekotype/shared/testing`) in chunks, because D1 allows 100 KB per statement.
- `scripts/batches.ts`: the bodies sent: the batches `learning`, `capped` and `results` of D14, `finished` (one finished test with its settings) and `largest` (the caps of the learning delta and 50 results in one batch). Results take their ids from a seed that changes with `seq`, so every request inserts new rows.
- `scripts/measure.ts`: checks that the Pages project exists, then, for each kind of request (the five batches and the `GET` of the acknowledgement and of each part; `--only name,name` runs some of them), deploys five times, sends one request to each fresh deployment (cold) and 50 more to the last one (warm), reads `cpuTime` from `wrangler pages deployment tail --format json`, and prints the table.

## Setup (once, by the maintainer)

The test project and its database are step M1 of the [P5 plan](../../docs/archive/p5-plan.md#m1-test-project-for-the-measurement--before-pr-1): `wrangler login`, a Pages project `nekotype-bench` (`pages project create … --force`) and a D1 database `nekotype-bench`, whose id is in `wrangler.toml`. Both were deleted when P5 was closed (M6); a new measurement repeats M1 and puts the new `database_id` into `wrangler.toml`.

## Run

```bash
pnpm --filter @nekotype/bench run seed                      # reset the row (measure does it too)
pnpm --filter @nekotype/bench run measure --out result.json # about 5 deployments per kind of request
```

`measure` deploys only to addresses ending in `nekotype-bench.pages.dev` and stops if wrangler hands the deploy to Workers static assets. Run the scripts from a plain terminal or an agent session; the project has Functions and a `_routes.json`, so it stays on Pages.

`cpuTime` in the tail is a whole number of milliseconds, so the percentiles are coarse; a request that takes under a millisecond reads as 0.
