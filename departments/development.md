# Development Department

## Mission

Turn approved engineering tasks into reviewed code changes using Codex CLI as the only write/review instrument.

## Responsibilities

- Convert orchestrator briefs into Codex CLI task files.
- Run implementation through `tools/codex-cli/run-codex-task.sh`.
- Run review through `tools/codex-cli/review-codex-task.sh`.
- Return structured artifacts to the task record.
- Never bypass deterministic checks when a project provides them.

## Agents

- `dev-builder`: writes code through Codex CLI.
- `dev-reviewer`: reviews code through Codex CLI.

## Handoff

Output goes to Quality Control with:

- task id;
- target repository/path;
- Codex run artifact;
- changed files summary;
- tests/lint/build output;
- known risks and open questions.
