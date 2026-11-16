import { applyBatch, readSnapshot } from '../../src/apply-batch';
import type { Applied } from '../../src/apply-batch';
import { applyKeyed, isPart, readPart, readVersion } from '../../src/apply-keyed';
import type { Env } from '../../src/d1';
import type { SyncRequest } from '@nekotype/shared/types';

// The measurement endpoint (p5-plan.md, PR 1). `POST` applies a batch, `GET` reads the snapshot.
// It answers with the `meta` of every D1 statement in the header `x-bench-meta`.
//
// `?variant=` chooses what is measured (the follow-up to ADR 081). `POST`: `base` (ADR 078 as
// built), `ack` (the same without the snapshot in the response), `keyed` (src/apply-keyed.ts).
// `GET`: `base` (the whole row), `empty` (no D1 at all), `floor` (one row by its key), and
// `recent`, `buckets`, `rest` (one part of the snapshot).

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

function variantOf(request: Request): string {
  return new URL(request.url).searchParams.get('variant') ?? 'base';
}

export async function onRequestPost(context: Context): Promise<Response> {
  const request: SyncRequest = await context.request.json();
  const variant = variantOf(context.request);
  const db = context.env.DB;
  if (variant === 'keyed') return respond(await applyKeyed(db, request, Date.now()));
  return respond(await applyBatch(db, request, Date.now(), variant !== 'ack'));
}

export async function onRequestGet(context: Context): Promise<Response> {
  const variant = variantOf(context.request);
  const db = context.env.DB;
  if (variant === 'empty') return respond({ body: '{}', metas: [], status: 200 });
  if (variant === 'floor') return respond(await readVersion(db));
  if (isPart(variant)) return respond(await readPart(db, variant));
  const deviceId = new URL(context.request.url).searchParams.get('deviceId') ?? '';
  return respond(await readSnapshot(db, deviceId));
}
