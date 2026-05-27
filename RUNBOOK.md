# AI Dev Office Runbook

This runbook explains how to deploy the repository as a real Hermes-based AI office.

## Mental Model

There is one Hermes installation/codebase on the server, but multiple Hermes runtime profiles:

```text
/usr/local/lib/hermes-agent          # one Hermes installation
/root/.hermes-ai-dev-office          # one AI Dev Office runtime home
/root/.hermes-ai-dev-office/profiles # multiple employees/profiles
```

Each profile is a separate agent identity with its own:

- `config.yaml`
- `.env`
- `AGENTS.md`
- sessions
- logs
- state
- Telegram bot token

For a real office, run one gateway process per profile:

```text
hermes --profile owner-assistant gateway run --replace
hermes --profile orchestrator gateway run --replace
hermes --profile dev-builder gateway run --replace
...
```

The same Hermes binary is reused, but agents are not just “one shell changing profile”. They are separate long-running gateway processes, so they can receive messages independently and work in parallel if needed.

## Recommended v1 Concurrency

Start all profiles as independent gateways, but keep workflow policy mostly sequential:

```text
Owner Assistant -> Orchestrator -> Dev Builder -> Dev Reviewer -> QA Lead -> Materials Librarian
```

Use queue mode for each profile so repeated messages do not interrupt an active task.

Parallelism is allowed later for independent tasks, but v1 should prefer a clear queue over many simultaneous branches.

## Server Prerequisites

- Hermes installed: `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash`
- Codex CLI installed and authenticated.
- Git installed.
- systemd user services available.
- Docker available if you want Postgres from `docker-compose.yml`.

## First Deploy

From the server:

```bash
git clone https://github.com/Glour/ai-dev-office.git /root/home/ai-dev-office
cd /root/home/ai-dev-office
scripts/bootstrap-hermes.sh
```

The bootstrap script will ask for:

- owner Telegram user id;
- group/chat id if agents live in a Telegram group;
- per-profile bot token;
- per-profile topic/thread id.

Tokens are written only to runtime `.env` files under:

```text
/root/.hermes-ai-dev-office/profiles/*/.env
```

They are not written into git.

## Operations

```bash
scripts/start-agents.sh
scripts/status-agents.sh
scripts/logs-agent.sh orchestrator
scripts/stop-agents.sh
```

## Postgres

```bash
cp .env.example .env
docker compose up -d postgres
docker compose exec postgres psql -U ai_dev_office -d ai_dev_office -c "select route_type from route_rules;"
```

## Codex CLI Contract

Agents must not edit code directly. Dev Builder and Dev Reviewer use:

```bash
tools/codex-cli/run-codex-task.sh --task-file path/to/task.md
tools/codex-cli/review-codex-task.sh --task-file path/to/review.md
```

## Rollback

Stop the office:

```bash
scripts/stop-agents.sh
```

Disable services:

```bash
systemctl --user disable hermes-gateway-ai-dev-office@{owner-assistant,orchestrator,dev-builder,dev-reviewer,qa-lead,materials-librarian,daily-auditor}.service
```

Runtime state stays in `/root/.hermes-ai-dev-office` unless you delete it manually.
