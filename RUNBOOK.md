# AI Dev Office — runbook развертывания

Этот документ объясняет, как превратить репозиторий в работающий AI-офис на Hermes.

## Как это устроено

На сервере стоит одна установка Hermes:

```text
/usr/local/lib/hermes-agent
```

Для офиса создается один runtime home:

```text
/root/.hermes-ai-dev-office
```

Внутри него лежат отдельные профили сотрудников:

```text
/root/.hermes-ai-dev-office/profiles/owner-assistant
/root/.hermes-ai-dev-office/profiles/orchestrator
/root/.hermes-ai-dev-office/profiles/dev-builder
/root/.hermes-ai-dev-office/profiles/dev-reviewer
/root/.hermes-ai-dev-office/profiles/qa-lead
/root/.hermes-ai-dev-office/profiles/materials-librarian
/root/.hermes-ai-dev-office/profiles/daily-auditor
```

Каждый профиль — отдельный агент со своими:

- `config.yaml`;
- `.env`;
- `AGENTS.md`;
- Telegram-ботом;
- очередью сообщений;
- памятью;
- сессиями;
- логами.

В рабочем режиме каждый профиль запускается отдельным gateway-процессом:

```text
hermes --profile owner-assistant gateway run --replace
hermes --profile orchestrator gateway run --replace
hermes --profile dev-builder gateway run --replace
...
```

То есть это не один агент, который «переключает профиль». Это несколько отдельных процессов, которые используют одну установку Hermes и один репозиторий офиса.

## Рекомендуемый режим v1

Все профили запускаются как отдельные gateway, но маршруты задач остаются в основном последовательными:

```text
Owner Assistant
→ Orchestrator
→ Dev Builder
→ Dev Reviewer
→ QA Lead
→ Materials Librarian
→ Owner Assistant
```

У каждого профиля включен queue-mode, поэтому новые сообщения не должны перебивать активную задачу.

Параллельное выполнение можно добавить позже через Postgres task queue и worker-диспетчер. Для первой версии безопаснее держать понятную очередь, чем запускать много веток одновременно.

## Требования к серверу

- Hermes установлен:

  ```bash
  curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
  ```

- Codex CLI установлен и авторизован.
- Git установлен.
- Доступен `systemd --user`.
- Docker доступен, если нужен Postgres из `docker-compose.yml`.

## Первое развертывание

На сервере:

```bash
git clone https://github.com/Glour/ai-dev-office.git /root/home/ai-dev-office
cd /root/home/ai-dev-office
scripts/bootstrap-hermes.sh
```

Bootstrap спросит:

- Telegram user id владельца;
- id группы/чата, если агенты живут в Telegram-группе;
- Telegram-токен для каждого профиля;
- topic/thread id для каждого профиля, если используется группа.

Скрипт проверяет каждый токен через Telegram `getMe`. Если токен неверный, bootstrap остановится до запуска сервисов.

Токены сохраняются только в runtime-файлах:

```text
/root/.hermes-ai-dev-office/profiles/*/.env
```

В git токены не попадают.

## Управление агентами

Запустить всех:

```bash
scripts/start-agents.sh
```

Остановить всех:

```bash
scripts/stop-agents.sh
```

Проверить статус:

```bash
scripts/status-agents.sh
```

Посмотреть логи одного агента:

```bash
scripts/logs-agent.sh orchestrator
```

## Postgres

```bash
cp .env.example .env
docker compose up -d postgres
docker compose exec postgres psql -U ai_dev_office -d ai_dev_office -c "select route_type from route_rules;"
```

Postgres — источник правды по задачам, событиям, артефактам, QC и материалам.

## Codex CLI

Агенты не пишут код напрямую. Для разработки и ревью используются только wrappers:

```bash
tools/codex-cli/run-codex-task.sh --task-file path/to/task.md
tools/codex-cli/review-codex-task.sh --task-file path/to/review.md
```

## Проверка Telegram

После запуска проверь:

```bash
for p in owner-assistant orchestrator dev-builder dev-reviewer qa-lead materials-librarian daily-auditor; do
  echo "=== $p ==="
  journalctl --user -u hermes-gateway-ai-dev-office@$p.service --since "10 min ago" --no-pager \
    | grep -E "Connected to Telegram|Gateway running|Provider authentication|Traceback|ERROR" || true
done
```

Нормальное состояние:

- есть `Connected to Telegram`;
- есть `Gateway running`;
- нет `Provider authentication failed`;
- нет `token was rejected`;
- нет `Traceback` после старта.

## Rollback

Остановить офис:

```bash
scripts/stop-agents.sh
```

Отключить сервисы:

```bash
systemctl --user disable hermes-gateway-ai-dev-office@{owner-assistant,orchestrator,dev-builder,dev-reviewer,qa-lead,materials-librarian,daily-auditor}.service
```

Runtime-данные останутся в:

```text
/root/.hermes-ai-dev-office
```

Удалять runtime вручную стоит только если точно нужен полный сброс памяти, сессий и токенов.
