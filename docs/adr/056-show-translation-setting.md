# ADR 056: The `showTranslation` Setting: an Optional Field of Settings v1

- **Status:** In force. Amended by [ADR 061](061-schema-reset-before-release.md): in P3 the field becomes required, because no saved value has to stay valid.
- **Context:** The spec (`frontend.md`, "Interface" and `/settings`) makes the translation under the stream depend on `showTranslation`, on by default. The code showed it always, and no phase planned the setting. The settings format is protected by the D18 migration, which already lists `showTranslation` with the default `true`.
- **Decision:**
  - `ValidSettings` gets an optional `showTranslation: boolean`. `isSettings` accepts a value without the field and rejects one that is not a boolean. A missing field means `true`, so what was saved before stays valid and the `v` of the format does not change.
  - `entities/settings` holds `showTranslationSetting` (a `ReadonlySignal`) and `setShowTranslation`; the value is saved with the other settings. It is not part of `PracticeSettings`.
  - `/settings` has a `Toggle` for it.
  - With the setting off, the translation line stays in the layout and its text is empty, so the stream does not move. The text is still a signal passed as a text node.
  - `setupSettingsResetWatcher` does not watch it: the setting changes what is shown, not the test, and it can only be changed on `/settings`, away from the running test.
- **Justification:** An optional field is the smallest change that needs no migration of its own; the D18 migration carries the value over when it exists. Making it required would turn every saved v1 value invalid and reset the user's settings.
- **Consequences:** The initial JS grows by a few bytes (the signal and the check); the toggle and its strings belong to the lazy settings chunk, except the two strings in the dictionaries.
