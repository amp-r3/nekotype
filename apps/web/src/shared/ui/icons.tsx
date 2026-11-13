import type { JSX } from 'preact';

export type IconProps = {
  readonly size?: number;
  readonly className?: string;
};

export function ResetIcon({ size = 16, className = '' }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 12a8 8 0 1 0 2.34-5.66M4 4v5h5" />
    </svg>
  );
}

export function RestartIcon({ size = 16, className = '' }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" />
    </svg>
  );
}
