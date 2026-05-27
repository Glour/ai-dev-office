# Workflow: Feature Development

1. Owner Assistant receives request and sends it to Orchestrator.
2. Orchestrator creates a task with route `feature_development`.
3. Dev Builder writes a Codex task brief and runs `tools/codex-cli/run-codex-task.sh`.
4. Dev Builder records changed files and deterministic checks.
5. Dev Reviewer runs `tools/codex-cli/review-codex-task.sh`.
6. QA Lead applies `qc/acceptance-gates.yaml`.
7. Materials Librarian stores reusable artifacts.
8. Owner Assistant returns the result.
