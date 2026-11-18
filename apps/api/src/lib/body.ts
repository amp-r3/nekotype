import { bodyLimit } from 'hono/body-limit';
import { ApiError } from './errors';

/** The largest body the API reads (docs/spec/backend.md); a route may set a smaller one. */
export const MAX_BODY_BYTES = 256 * 1024;

export function limitBody(maxSize: number = MAX_BODY_BYTES) {
  return bodyLimit({
    maxSize,
    onError: () => {
      throw new ApiError('too_large');
    },
  });
}
