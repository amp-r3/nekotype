# ADR 024: AGENTS.md as the Single Agent Instruction File

- **Context:** Different AI coding agents read different instruction files, and every line of such a file is loaded into each agent session.
- **Decision:** `AGENTS.md` is the source; `CLAUDE.md` is a symlink to it. The pre-commit hook rejects any staged `AGENTS.md` or `CLAUDE.md` over 250 lines; details belong in `docs/` and are linked from `AGENTS.md`.
- **Justification:** One file avoids drift between agents, and the line limit keeps the instructions short enough not to crowd the context.
- **Status:** In force. Amended by [ADR 105](105-agents-md-in-100-lines-advisor-and-branch.md): the limit is 100 lines.
