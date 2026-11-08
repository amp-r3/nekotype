export { Button } from './button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './button';

export { Dialog } from './dialog';
export type { DialogProps } from './dialog';

export { Segmented } from './segmented';
export type { SegmentedProps, SegmentedOption } from './segmented';

export { Switch } from './switch';
export type { SwitchProps } from './switch';

export { Link } from './link';
export type { LinkProps } from './link';

export { Nav } from './nav';
export type { NavProps, NavItem } from './nav';

export { Footer } from './footer';
export type { FooterProps } from './footer';

export { Kbd } from './kbd';
export type { KbdProps } from './kbd';

export { KeyboardIcon, ResetIcon, RefreshIcon, CheckIcon } from './icons';
export type { IconProps } from './icons';

// `KanaChart`, `KanaTask`, `OptionCard` and `createTaskController` are not exported here: this barrel
// is in the initial graph, which would pull them into the initial chunk. The learning screen imports
// them from their own files ('@/shared/ui/kana-chart', …) until learning is the initial route.
