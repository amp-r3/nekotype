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

const itemClass =
  'text-ui-label h-control-sm pointer-coarse:min-h-touch-min flex flex-1 items-center justify-center rounded-sm px-3 whitespace-nowrap transition-colors sm:flex-none';

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
      className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4 select-none"
    >
      <Link href={brandHref} onNavigate={onNavigate} className="order-1 flex items-center">
        {brand}
      </Link>

      <nav aria-label={ariaLabel} className="order-3 flex w-full gap-1 sm:order-2 sm:w-auto">
        {items.map((item) => {
          const current = item.href === currentPath;
          return (
            <Link
              key={item.href}
              href={item.href}
              onNavigate={onNavigate}
              current={current}
              className={cx(
                itemClass,
                current ? 'text-fur' : 'text-fur-dim hover:text-fur hover:bg-bg-hover',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="order-2 flex items-center gap-2 sm:order-3">{trailing}</div>
    </header>
  );
}
