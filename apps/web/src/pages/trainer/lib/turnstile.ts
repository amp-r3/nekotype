import { isObject } from '@nekotype/shared/runtime';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// Site keys are public (p5-plan.md, D21). Cloudflare's always-passing test key serves `localhost`,
// where the widget needs no registered hostname.
const PRODUCTION_HOST = 'nekotype.pages.dev';
const PRODUCTION_KEY = '0x4AAAAAAGIZ6j5k_9gy6m6Z';
const PREVIEW_KEY = '0x4AAAAAAGIaKDNtOwbAu8TP';
const TEST_KEY = '1x00000000000000000000AA';

/** The widget of the host: the production key, the preview key on its subdomains, a test key elsewhere. */
export function siteKeyFor(hostname: string): string {
  if (hostname === PRODUCTION_HOST) return PRODUCTION_KEY;
  if (hostname.endsWith(`.${PRODUCTION_HOST}`)) return PREVIEW_KEY;
  return TEST_KEY;
}

export type TurnstileOptions = {
  readonly sitekey: string;
  readonly theme: 'dark';
  readonly size: 'flexible';
  readonly language: string;
  readonly callback: (token: string) => void;
  readonly 'error-callback': () => void;
  readonly 'expired-callback': () => void;
};

/** The part of `window.turnstile` this page uses. */
export type TurnstileApi = {
  render(container: HTMLElement, options: TurnstileOptions): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

/** Resolves to the API, or rejects when the script cannot be loaded. */
export type TurnstileLoader = () => Promise<TurnstileApi>;

function apiOf(value: unknown): TurnstileApi | null {
  if (!isObject(value)) return null;
  const { render, reset, remove } = value;
  if (typeof render !== 'function' || typeof reset !== 'function' || typeof remove !== 'function') {
    return null;
  }
  // The functions are Cloudflare's; each call goes through the object, which keeps its `this`.
  return {
    render: (container, options) => {
      const id: unknown = Reflect.apply(render, value, [container, options]);
      if (typeof id !== 'string') throw new Error('turnstile.render returned no widget id');
      return id;
    },
    reset: (id) => {
      Reflect.apply(reset, value, [id]);
    },
    remove: (id) => {
      Reflect.apply(remove, value, [id]);
    },
  };
}

let loading: Promise<TurnstileApi> | undefined;

/**
 * Adds Cloudflare's script to the page the first time it is called, which is when the report dialog
 * opens, never before. A failure is not kept: the next call tries again.
 */
export const loadTurnstile: TurnstileLoader = () => {
  if (loading !== undefined) return loading;
  const attempt = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const api = apiOf(Reflect.get(window, 'turnstile'));
      if (api === null) {
        script.remove();
        reject(new Error('turnstile did not initialise'));
        return;
      }
      resolve(api);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('turnstile script failed to load'));
    };
    document.head.appendChild(script);
  });
  loading = attempt;
  attempt.catch(() => {
    if (loading === attempt) loading = undefined;
  });
  return attempt;
};
