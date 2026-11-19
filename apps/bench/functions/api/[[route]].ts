import { onRequest as application } from '../../../api/src/pages-entry';
import { countingDb } from '../../../api/src/test-support';

// The real application of `apps/api`, measured on Cloudflare (p5-plan.md, PR 5 and PR 13). Only the
// database binding is wrapped, with the counter of the API tests, to hand back in the header
// `x-bench-meta` every statement of the request (the session lookup included) and the rows they
// read and wrote: D1 does not report them anywhere else.

export const onRequest: typeof application = async (context) => {
  const counting = countingDb(context.env.DB);
  const response = await application({ ...context, env: { ...context.env, DB: counting.db } });
  const measured = new Response(response.body, response);
  measured.headers.set('x-bench-meta', JSON.stringify(counting.log));
  return measured;
};
