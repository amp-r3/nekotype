export type CiScope = {
  readonly docsOnly: boolean;
  readonly webE2e: boolean;
  readonly syncE2e: boolean;
};

export function ciScope(files: readonly string[]): CiScope;
