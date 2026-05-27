# Code Review Policy

Code review is performed through Codex CLI, not by direct manual edits from Hermes agents.

Review findings must lead with:

1. correctness bugs;
2. security or data-loss risks;
3. broken acceptance criteria;
4. missing deterministic tests;
5. maintainability issues.

The reviewer returns one of:

- `pass`
- `pass-with-notes`
- `changes-required`
- `blocked`

Any `changes-required` result routes back to Orchestrator as `bugfix`.
