# AI Dev Office

Executable MVP for a personal AI development office.

The office is organized as a small company, not as a pile of chats:

```text
Owner Assistant
-> Orchestrator
-> Dev Builder via Codex CLI
-> Tests/Lint
-> Dev Reviewer via Codex CLI
-> QA Lead
-> Materials Librarian
-> Owner Assistant
```

## What This Repo Owns

- Org-as-code: departments, agents, routes, QC gates, workflows.
- Runtime templates for Hermes profiles.
- Postgres schema for tasks, events, approvals, artifacts, QC, materials, incidents, and audits.
- Codex CLI tool contract. Code writing and code review must go through this contract.
- Universal QA tool based on Playwright.
- n8n adapter contract only. Self-hosted n8n is intentionally not part of v1.

## What Runtime Owns

Hermes runtime state is not stored in this repo. Deployment copies templates from:

```text
hermes/profiles/*
```

into:

```text
/root/.hermes-ai-dev-office/profiles/*
```

Runtime state, secrets, sessions, logs, and caches stay outside git.

## Quick Start

```bash
cp .env.example .env
docker compose up -d postgres
docker compose exec postgres psql -U ai_dev_office -d ai_dev_office -c "select count(*) from route_rules;"
```

Deploy Hermes profiles on a server:

```bash
scripts/bootstrap-hermes.sh
scripts/start-agents.sh
scripts/status-agents.sh
```

See [RUNBOOK.md](RUNBOOK.md) for the full deployment and operations flow.

Run the QA tool:

```bash
cd tools/universal-qa
npm install
npm run list-checks
npm run qa -- ./configs/example-site.json --no-strict
```

Run a Codex task wrapper dry smoke:

```bash
tools/codex-cli/run-codex-task.sh --task-file tools/codex-cli/examples/example-task.md --dry-run
tools/codex-cli/review-codex-task.sh --task-file tools/codex-cli/examples/example-review.md --dry-run
```

## Non-Negotiable Development Rule

Hermes agents do not edit code directly.

Any code change, bug fix, refactor, migration, architecture review, or implementation review must be delegated to Codex CLI through `tools/codex-cli/`.

Hermes agents may:

- classify owner requests;
- create tasks;
- choose routes;
- prepare task briefs;
- run approved tools;
- read artifacts and logs;
- summarize results.

Hermes agents must not bypass Codex CLI for code writing or code review.

## Hermes Profile Runtime

The office uses one Hermes installation and multiple profile runtimes. In production, each profile should run as its own gateway process via systemd:

```text
hermes-gateway-ai-dev-office@owner-assistant.service
hermes-gateway-ai-dev-office@orchestrator.service
hermes-gateway-ai-dev-office@dev-builder.service
...
```

This lets each agent keep its own Telegram bot, queue, memory, sessions, and logs while still sharing the same office repo and Hermes installation.
