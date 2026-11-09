export const BUDGETS: {
  readonly htmlGzipKb: number;
  readonly initialJsGzipKb: number;
  readonly initialCssGzipKb: number;
  readonly fontKb: number;
  readonly totalFirstLoadKb: number;
  readonly lazyRouteGzipKb: number;
  readonly lazyContentGzipKb: number;
};

export const PROBE_MARKER: string;

export const SIGNALS_MARKER: string;

export function checkBudget(distDir: string): {
  readonly lines: readonly string[];
  readonly failures: readonly string[];
};
