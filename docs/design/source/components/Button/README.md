# Button

Four variants: `primary`, `secondary`, `text`, `danger`. Three sizes: `sm`, `md`, `lg`.

**In code:** the variants are `primary` / `secondary` / `ghost` / `danger` — `ghost` is this system's `text`. The system keeps its names; the mapping is fixed here.

- `primary` — `fur` fill, `on-fur` text. One per screen: `continue` / `продолжить`.
- `secondary` — `line-strong` border. The alternative next to the primary: `to the table` / `к таблице`, `retry`.
- `text` (in code: `ghost`) — `fur-dim`. Tertiary actions: `leave session` / `выйти`, `show the romaji` under `pointer: coarse`.
- `danger` — `miss` text and border. Irreversible actions only: reset progress, delete account. Always leads to a `Dialog`.
- `size="lg"` — `control-h` height with `space-6` padding: `continue`, `to the table`. `md` — `control-h`, `sm` — `control-h-sm`; at least `touch-min` under `pointer: coarse`. No fixed width.
- `hint` — the key after the label: `enter` on `continue` in the session summary.
- `icon` — `reset` (see README, Iconography). Always next to a label, never alone.

**Buttons that keep the phone keyboard open (ADR 055).** `continue` hands focus to the page's hidden input inside its click handler. It is always a real `<button>` element.
