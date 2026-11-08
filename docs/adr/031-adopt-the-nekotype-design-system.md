# ADR 031: Adopt the Nekotype Design System from P2

- **Status:** In force. Amends A31. Amended by [ADR 058](058-learning-first.md): the navigation links learning at `/` and typing at `/type`. Amended by [ADR 059](059-design-system-v10.md): the reference is version 10 of the design system, and the code takes its component names.
- **Context:** A31 kept the MVP interface basic and planned a full redesign for v1.1. A design system for the product now exists as a [private artifact](https://claude.ai/artifact/22bxWBXuofNxqfnPzuvej1): tokens, components, logo and cat assets. It was written separately from the spec and disagreed with it on metrics, on what a test screen shows, and on motion.
- **Decision:**
  - New screens follow the design system from P2. No separate redesign is planned. Views stay separated from logic, as "UI architecture" in [Frontend](../spec/frontend.md) requires.
  - The spec stays normative. The system is imported into `docs/design/` once it matches the spec.
  - **Token states:** upcoming text is dim and completed text is bright, instead of the reverse.
  - **Romaji buffer:** the remainder from `engine.view()` is shown at the caret, replacing the separate input field of D13.
  - **Live indicators:** the live strip shrinks to the counter, KPM and kana accuracy. Strictness is not shown during a test.
  - **Rejected key:** a 120 ms caret flash replaces the 280 ms shake.
  - **Personal best:** a badge and the `content` cat replace confetti.
  - **Navigation:** it gains a link to `/learn` and the locale switch. "Reset progress" moves to `/settings`, still for guests only.
  - **Cat:** the product uses the `geometry` style.
  - The code keeps its current interface until the matching phase changes it: the shake and the live strip are replaced in P2, and confetti is never built.
- **Justification:** The screens are written in P2–P5 anyway, so a basic interface followed by a redesign would do that work twice. The buffer keeps the eyes on the text and uses the same engine data as the field. Without the shake a repeated wrong key on an already red character would give no signal, so the caret flash stays. Alternatives rejected: keeping A31 (rework in v1.1); removing the live strip entirely (speed would be invisible during a test); keeping confetti (the system allows only functional micro-animations).
