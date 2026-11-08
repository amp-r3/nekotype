# Select

A native `<select>` styled as `Input`.

- `/settings` · `target answer time` / `целевое время ответа`: nine values, `1000 ms` … `3000 ms` in steps of 250, default `1500 ms` / `1500 мс`. **Why a Select** (decision 71): nine options do not fit one segment row at 360 (≈ 9 × 56px), and a slider would be a new component; a native select fits any width, is keyboard-ready and opens the system picker on a phone.
- Report dialog: the reason (`wrong_reading`, `wrong_translation`, `other`).
- The arrow is drawn with `fur-dim` lines, no icon. Offline the field is disabled, the reason is in `hint`.
