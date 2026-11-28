# RadioGroup

One choice of a few, each a sentence too long for `Segmented`: the reason of the report dialog (decision 167).

- A `fieldset` with its `legend` (`ui-caption`, `fur-dim`) and the options under it, `space-1` apart, `control-h-sm` each (`touch-min` under `pointer: coarse`).
- A circle of 16px: `line-strong` border on `bg`; chosen — `fur` border and an 8px `eye` dot. Hover — `fur-dim` border. Focus — the system's ring. The label `ui-body`, `fur`.
- Disabled (a request in flight, offline): labels `fur-faint`, circles `line`, no fill.
- **Nothing is chosen in advance**: a default would be sent by whoever does not read it. The action that needs a choice is disabled until there is one.
- Keyboard: `Tab` to the group, arrows between options (native radio inputs).
