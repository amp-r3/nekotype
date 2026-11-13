import type { JSX } from 'preact';
import { Link } from './link';

export type FooterProps = {
  readonly aboutHref: string;
  readonly aboutLabel: string;
  readonly currentPath: string;
  readonly onNavigate: (href: string) => void;
};

export function Footer({
  aboutHref,
  aboutLabel,
  currentPath,
  onNavigate,
}: FooterProps): JSX.Element {
  return (
    <footer data-chrome className="flex w-full justify-center pt-8">
      <Link
        href={aboutHref}
        onNavigate={onNavigate}
        current={currentPath === aboutHref}
        className="text-ui-caption text-fur-dim hover:text-fur decoration-line-strong hover:decoration-fur-dim pointer-coarse:min-h-touch-min inline-flex items-center rounded-xs underline underline-offset-[3px] transition-colors"
      >
        {aboutLabel}
      </Link>
    </footer>
  );
}
