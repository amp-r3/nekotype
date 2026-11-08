# HistoryTable

Paginated typing test history on `/stats`: `date` / `дата`, `mode` / `режим`, `kpm`, `accuracy` / `точность`, `time` / `время`. 10 rows per page, `Pagination` under the table.

- Headers `ui-caption` / `fur-dim`, rows separated by `line`, numbers right-aligned in `mono-romaji`.
- Mode: `words · 60 s` / `слова · 60 с`, `phrases · 25`, `words · zen`. A repeat (ADR 033) is a word in the mode column: `words · 60 s · repeat` / `слова · 60 с · повтор`; it is never a personal best. A personal best gets `PersonalBestBadge`.
- Loading the next page — a `Notice` `loading history…` / `загрузка истории…` under the table. No skeletons, no shimmer.
- Container ≤ 480px: each row becomes a two-line block (date on top; mode, KPM, accuracy below), time is hidden.
