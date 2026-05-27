# AI Dev Office

Executable MVP личного AI-офиса для разработки.

Офис устроен как маленькая управляемая команда, а не как набор разрозненных чатов:

```text
Owner Assistant
→ Orchestrator
→ Dev Builder через Codex CLI
→ Tests/Lint
→ Dev Reviewer через Codex CLI
→ QA Lead
→ Materials Librarian
→ Owner Assistant
```

## Что хранится в репозитории

- Оргструктура: отделы, агенты, маршруты, QC-gates, workflows.
- Шаблоны Hermes-профилей.
- Postgres-схема для задач, событий, согласований, артефактов, QC, материалов, инцидентов и аудитов.
- Контракт Codex CLI: писать код и делать ревью кода можно только через wrappers.
- Universal QA tool на Playwright.
- n8n adapter contract. Self-hosted n8n в v1 не поднимается.

## Что хранится в runtime

Состояние Hermes не хранится в git. При развертывании шаблоны из:

```text
hermes/profiles/*
```

копируются в:

```text
/root/.hermes-ai-dev-office/profiles/*
```

Секреты, токены, сессии, логи, кэши и runtime-state остаются вне репозитория.

## Быстрый старт

Postgres:

```bash
cp .env.example .env
docker compose up -d postgres
docker compose exec postgres psql -U ai_dev_office -d ai_dev_office -c "select count(*) from route_rules;"
```

Hermes-профили на сервере:

```bash
scripts/bootstrap-hermes.sh
scripts/start-agents.sh
scripts/status-agents.sh
```

Полный сценарий развертывания описан в [RUNBOOK.md](RUNBOOK.md).

Command Center:

```bash
npm --prefix apps/command-center install
npm --prefix apps/command-center run build
scripts/start-command-center.sh
```

По умолчанию интерфейс слушает `127.0.0.1/0.0.0.0:3310` через Next и читает тот же Postgres, что и офис.

Provider auth для Hermes проверяется отдельно:

```bash
scripts/check-provider-auth.sh
```

Если Hermes не видит OpenAI Codex credentials:

```bash
hermes auth add openai-codex
scripts/bootstrap-provider-auth.sh
```

Universal QA:

```bash
cd tools/universal-qa
npm install
npm run list-checks
npm run qa -- ./configs/example-site.json --no-strict
```

Codex CLI dry-run:

```bash
tools/codex-cli/run-codex-task.sh --task-file tools/codex-cli/examples/example-task.md --dry-run
tools/codex-cli/review-codex-task.sh --task-file tools/codex-cli/examples/example-review.md --dry-run
```

## Главное правило разработки

Hermes-агенты не редактируют код напрямую.

Любое изменение кода, исправление бага, рефакторинг, миграция, архитектурное ревью или ревью реализации выполняется через wrappers в `tools/codex-cli/`.

Агенты могут:

- классифицировать запрос владельца;
- создавать задачи;
- выбирать маршруты;
- готовить task brief;
- запускать утвержденные инструменты;
- читать артефакты и логи;
- возвращать понятный итог.

Агенты не должны обходить Codex CLI при написании или ревью кода.

## Hermes-профили

Офис использует одну установку Hermes и несколько профилей. В production каждый профиль запускается отдельным gateway-процессом через systemd:

```text
hermes-gateway-ai-dev-office@owner-assistant.service
hermes-gateway-ai-dev-office@orchestrator.service
hermes-gateway-ai-dev-office@dev-builder.service
...
```

Так у каждого агента есть свой Telegram-бот, очередь, память, сессии и логи, но они используют общий репозиторий офиса и одну установку Hermes.
