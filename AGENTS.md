# AI Dev Office Agent Rules

This repository is the source of truth for the personal AI development office.

## Core Flow

Owner Assistant -> Orchestrator -> Dev Builder -> deterministic checks -> Dev Reviewer -> QA Lead -> Materials Librarian -> Owner Assistant.

## Code Work Policy

All code writing and code review must use the Codex CLI wrappers in `tools/codex-cli/`.

Agents must not directly edit source code in target projects. They produce task briefs and hand them to Codex CLI. The resulting artifacts are then checked by deterministic tests and QA.

## State Policy

Postgres is the canonical task state. Logs and artifacts may exist on disk, but task truth must be represented in:

- `tasks`
- `task_steps`
- `events`
- `agent_runs`
- `artifacts`
- `qc_results`
- `materials`
- `incidents`
- `daily_audits`

## Routing Policy

Routes are defined in `routes/`. Every workflow must identify:

- route type;
- owner-facing outcome;
- assigned department;
- primary agent;
- required tools;
- QC gate;
- approval policy;
- storage target.

## QA Policy

No owner-facing result is final until QC either passes it or records why the result is blocked.

For code work, QA must include deterministic checks first: tests, lint, typecheck, build, migration validation, or a documented reason why a check is not available.
