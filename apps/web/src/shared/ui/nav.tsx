import type { ComponentChildren, JSX } from 'preact';
import { cx } from '../lib';
import { Link } from './link';

export type NavItem = {
  readonly href: string;
  readonly label: string;
};

export type NavProps = {
  // The logo; it is the link to `brandHref`.
  readonly brand: ComponentChildren;
  readonly brandHref: string;
  readonly items: readonly NavItem[];
  readonly currentPath: string;
  readonly onNavigate: (href: string) => void;
  readonly ariaLabel: string;
  // Controls at the end of the bar, such as the language switch.
  readonly trailing?: ComponentChildren;
};

// Plain text links: no fill, only the colour changes (design `nk-nav__link`).
const itemClass =
  'text-ui-label pointer-coarse:min-h-touch-min inline-flex items-center rounded-xs whitespace-nowrap transition-colors';

export function Nav({
  brand,
  brandHref,
  items,
  currentPath,
  onNavigate,
  ariaLabel,
  trailing,
}: NavProps): JSX.Element {
  return (
    <header
      data-chrome
      className="min-h-nav flex w-full flex-wrap items-center gap-x-8 select-none max-sm:gap-x-4 max-sm:pt-2"
    >
      <Link href={brandHref} onNavigate={onNavigate} className="order-1 flex items-center">
        {brand}
      </Link>

      <nav
        aria-label={ariaLabel}
        className="order-2 flex gap-6 max-sm:order-3 max-sm:w-full max-sm:justify-between max-sm:gap-2"
      >
        {items.map((item) => {
          const current = item.href === currentPath;
          return (
            <Link
              key={item.href}
              href={item.href}
              onNavigate={onNavigate}
              current={current}
              className={cx(itemClass, current ? 'text-fur' : 'text-fur-dim hover:text-fur')}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="order-3 ml-auto flex items-center gap-6 max-sm:order-2 max-sm:gap-4">
        {trailing}
      </div>
    </header>
  );
}
