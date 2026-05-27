# Workflow: разработка функции

1. Owner Assistant принимает запрос владельца и передает его Orchestrator.
2. Orchestrator создает задачу с маршрутом `feature_development`.
3. Dev Builder готовит brief для Codex CLI и запускает `tools/codex-cli/run-codex-task.sh`.
4. Dev Builder фиксирует измененные файлы и детерминированные проверки.
5. Dev Reviewer запускает `tools/codex-cli/review-codex-task.sh`.
6. QA Lead применяет `qc/acceptance-gates.yaml`.
7. Materials Librarian сохраняет переиспользуемые артефакты.
8. Owner Assistant возвращает владельцу проверенный результат.
