# Notice

Nekotype — Copyright (C) 2026 amp-r3 — <https://github.com/amp-r3/nekotype>

This repository contains material under three different terms. A file is covered by the first row of the table below that matches it.

| Material                                                    | Terms                                                                                          | Where the terms are                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------- |
| The Nekotype brand and mascot (list below)                  | All rights reserved                                                                            | [BRAND.md](BRAND.md)                   |
| Fonts                                                       | SIL Open Font License 1.1 (`OFL-1.1`)                                                          | the `OFL-*.txt` file next to each font |
| Everything else: source code, tests, tooling, documentation | GNU Affero General Public License v3.0 only (`AGPL-3.0-only`), with the additional terms below | [LICENSE](LICENSE)                     |

## The brand and mascot

Not covered by the AGPL. Copyright (C) 2026 amp-r3. All rights reserved.

- The name "Nekotype" and "ねこタイプ", used as the name of a product or service.
- `apps/web/public/favicon.svg`
- `apps/web/src/assets/logo/` (the lockup)
- `docs/design/readme-banner.svg`
- `docs/design/source/assets/` (logo, wordmark, marks, favicon and cat drawings)
- The cat drawings in code: the shapes (the `path`, `circle` and `rect` geometry) in `apps/web/src/shared/ui/cat.tsx` and the `CAT` data in `docs/design/source/components/bundle.js`. The code around them is under the AGPL.
- Any other drawing of the Nekotype cat or logo, in any style or format, including later versions of the files above.

## Fonts

Not covered by the AGPL. Each font keeps the copyright of its authors and is licensed under the SIL Open Font License 1.1; the subsets in `apps/web/src/assets/fonts/` are Modified Versions under that licence.

| Font           | Files                                                                                                  | Licence                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Golos Text     | `apps/web/src/assets/fonts/GolosText-*.woff2`, `apps/web/scripts/font-src/GolosText[wght].ttf`         | [OFL-GolosText.txt](apps/web/src/assets/fonts/OFL-GolosText.txt)         |
| JetBrains Mono | `apps/web/src/assets/fonts/JetBrainsMono-*.woff2`, `apps/web/scripts/font-src/JetBrainsMono[wght].ttf` | [OFL-JetBrainsMono.txt](apps/web/src/assets/fonts/OFL-JetBrainsMono.txt) |
| Noto Sans JP   | `apps/web/src/assets/fonts/NotoSansJP-*.woff2`, `apps/web/scripts/font-src/NotoSansJP[wght].ttf`       | [OFL-NotoSansJP.txt](apps/web/src/assets/fonts/OFL-NotoSansJP.txt)       |

## Source code: AGPL-3.0-only

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, version 3 of the License only.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

In short (the licence text decides): if you modify this program and let people use it over a network, for example by deploying it as a website, you must offer them the complete source code of your version under the AGPL-3.0, keep the copyright and licence notices, and mark your changes with the date.

### Additional terms under section 7 of the AGPL

1. **Attribution (section 7(b)).** You must keep the notice "Copyright (C) 2026 amp-r3" and this file in every copy of the source code. A modified version that displays Appropriate Legal Notices must include in them the line "Based on Nekotype by amp-r3" with a link to <https://github.com/amp-r3/nekotype>.
2. **Origin (section 7(c)).** A modified version must not be presented as the original Nekotype or as made or endorsed by amp-r3, and must be marked as different from the original version.
3. **Trademarks (section 7(e)).** The AGPL grants no rights to the name "Nekotype", the logos or the mascot. A modified version that is conveyed or offered to users over a network must replace them, as described in [BRAND.md](BRAND.md).

## Third-party data

Data generated from third-party sources (dictionaries, sentence corpora, recordings) keeps the licence of its source; [docs/spec/content.md](docs/spec/content.md) lists them.

## Contributions

By submitting a contribution you agree that it is licensed under the AGPL-3.0-only. A contribution to a file listed under "The brand and mascot" is accepted only if you also grant amp-r3 a perpetual, worldwide, royalty-free licence to use, modify and license it as part of the brand.
