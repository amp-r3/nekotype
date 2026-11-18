export function assetPaths(html: string): string[];

export type FetchFn = (url: URL, init: { redirect: 'manual' }) => Promise<Response>;

export function checkDeployment(
  baseUrl: string,
  options?: {
    readonly fetchFn?: FetchFn;
    readonly production?: boolean;
    readonly apiAttempts?: number;
    readonly apiDelayMs?: number;
    readonly sleep?: (ms: number) => Promise<void>;
  },
): Promise<{ readonly lines: string[]; readonly failures: string[] }>;

export function waitForDeployment(
  baseUrl: string,
  options?: {
    readonly fetchFn?: FetchFn;
    readonly attempts?: number;
    readonly delayMs?: number;
    readonly sleep?: (ms: number) => Promise<void>;
  },
): Promise<boolean>;

export function resolveTargetUrl(options: {
  readonly outputFile?: string | undefined;
  readonly fallback?: string | undefined;
  readonly readFile?: (path: string) => string;
}): string | undefined;
