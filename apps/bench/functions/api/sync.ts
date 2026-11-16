import { applyBatch, readSnapshot } from '../../src/apply-batch';
import type { Applied } from '../../src/apply-batch';
import type { Env } from '../../src/d1';
import type { SyncRequest } from '@nekotype/shared/types';

// The measurement endpoint (p5-plan.md, PR 1). `POST` applies a batch, `GET` reads the snapshot.
// It answers with the `meta` of every D1 statement in the header `x-bench-meta`.

type Context = { readonly request: Request; readonly env: Env };

function respond(applied: Applied): Response {
  return new Response(applied.body, {
    status: applied.status,
    headers: {
      'content-type': 'application/json',
      'x-bench-meta': JSON.stringify(applied.metas),
    },
  });
}

export async function onRequestPost(context: Context): Promise<Response> {
  const request: SyncRequest = await context.request.json();
  return respond(await applyBatch(context.env.DB, request, Date.now()));
}

export async function onRequestGet(context: Context): Promise<Response> {
  const deviceId = new URL(context.request.url).searchParams.get('deviceId') ?? '';
  return respond(await readSnapshot(context.env.DB, deviceId));
}
