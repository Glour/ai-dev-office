# Codex CLI Policy

Codex CLI is the only approved implementation and code-review instrument for AI Dev Office engineering work.

## Agents May

- Create task briefs.
- Invoke wrappers in this directory.
- Read artifacts.
- Summarize results.
- Route failed work back to Orchestrator.

## Agents Must Not

- Edit target repository files directly.
- Run ad hoc code generation outside the wrapper.
- Skip deterministic checks when the target project provides them.
- Hide failed tests, lint, build, migration, or review findings.

## Required Artifact

Every Codex CLI run must produce a directory containing:

- `task.md`
- `run.json`
- `stdout.log`
- `stderr.log`
- optional `review.md`
