import { onRequest as application } from '../../../api/src/pages-entry';

// The real application of `apps/api`, measured on Cloudflare (p5-plan.md, PR 5). Only the database
// binding is wrapped, to hand the `meta` of every `batch()` back in the header `x-bench-meta`:
// D1 does not report rows read and written anywhere else.

export const onRequest: typeof application = async (context) => {
  const metas: unknown[] = [];
  const db = new Proxy(context.env.DB, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      if (property !== 'batch')
        return (...args: unknown[]): unknown => Reflect.apply(value, target, args);
      return async (...args: unknown[]): Promise<unknown> => {
        const results: unknown = await Reflect.apply(value, target, args);
        if (Array.isArray(results)) {
          for (const result of results) {
            if (typeof result === 'object' && result !== null && 'meta' in result) {
              metas.push(result.meta);
            }
          }
        }
        return results;
      };
    },
  });
  const response = await application({ ...context, env: { ...context.env, DB: db } });
  const measured = new Response(response.body, response);
  measured.headers.set('x-bench-meta', JSON.stringify(metas));
  return measured;
};
