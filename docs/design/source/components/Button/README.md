# Button

Four variants: `primary`, `secondary`, `text`, `danger`. Three sizes: `sm`, `md`, `lg`.

**In code:** the variants are `primary` / `secondary` / `ghost` / `danger` — `ghost` is this system's `text`. The system keeps its names; the mapping is fixed here.

- `primary` — `fur` fill, `on-fur` text. One per screen: `next test` / `новый тест`, `continue` / `продолжить`.
- `secondary` — `line-strong` border. The alternative next to the primary: `repeat`, `review (5)` / `повторение (5)`, `retry`.
- `text` (in code: `ghost`) — `fur-dim`. Restart during a typing test and tertiary actions.
- `danger` — `miss` text and border. Irreversible actions only: reset progress, delete account. Always leads to a `Dialog`.
- `size="lg"` — `control-h` height with `space-6` padding: `next test`, `continue`, `review (N)`. `md` — `control-h`, `sm` — `control-h-sm`; at least `touch-min` under `pointer: coarse`. No fixed width.
- `hint` — the key after the label: `enter` on `next test`, `ctrl + enter` / `⌘ + enter` on `finish`.
- `icon` — `restart` or `reset` (see README, Iconography). Always next to a label, never alone.

**Buttons that keep the phone keyboard open (ADR 055).** Restart, finish, next test and, from P3, continue and review hand focus to the page's hidden input inside their click handler. They are always real `<button>` elements.

**Restart (ADR 041, 055).** `variant="text"`, `icon="restart"`, class `nk-on-focus`: invisible until it receives focus with `Tab`; also visible on pointer hover on devices with hover, and always visible under `pointer: coarse` (a phone has no Tab). It is never removed from the layout. Label on desktop: `tab → enter — restart` / `tab → enter — заново`; on a phone: `restart` / `заново`.

**Finish in zen (ADR 042).** `variant="secondary"`, `size="sm"`, `hint="ctrl + enter"` (`⌘ + enter` on Apple devices — `⌘` is not in the subsets and falls back to the system font). Zen only; after Restart in the focus order; disabled until the test's first key.
