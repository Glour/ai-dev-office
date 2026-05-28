BEGIN;

CREATE TABLE IF NOT EXISTS office_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_type TEXT NOT NULL CHECK (capability_type IN ('skill', 'tool')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'disabled', 'archived')),
  scope_department TEXT,
  scope_agent TEXT,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_office_capabilities_type_status ON office_capabilities (capability_type, status);
CREATE INDEX IF NOT EXISTS idx_office_capabilities_scope ON office_capabilities (scope_department, scope_agent);

INSERT INTO route_rules (route_type, name, department, primary_agent, qc_required, approval_required, definition)
VALUES ('owner_request', 'Owner request intake', 'management', 'owner-assistant', true, false, '{"workflow":"workflows/owner-request.md","next":["orchestrator"],"routing":"auto"}')
ON CONFLICT (route_type) DO UPDATE
SET name = EXCLUDED.name,
    department = EXCLUDED.department,
    primary_agent = EXCLUDED.primary_agent,
    qc_required = EXCLUDED.qc_required,
    approval_required = EXCLUDED.approval_required,
    definition = EXCLUDED.definition,
    updated_at = now();

INSERT INTO office_capabilities (capability_type, name, slug, status, scope_department, scope_agent, description, instructions, config)
VALUES
  ('tool', 'Codex CLI', 'codex-cli', 'active', 'development', NULL, 'Единственный инструмент разработки и code review для dev-отдела.', 'Агенты не редактируют код напрямую. Любое изменение кода и ревью выполняется через tools/codex-cli wrappers.', '{"wrapper":"tools/codex-cli/run-codex-task.sh","review_wrapper":"tools/codex-cli/review-codex-task.sh"}'),
  ('tool', 'Universal QA', 'universal-qa', 'active', 'quality-control', 'qa-lead', 'Полуавтоматический QA-gate: UI, console, network, accessibility, performance budget.', 'QA Lead запускает проверки по acceptance gates и сохраняет report.md/manual-results.json.', '{"path":"tools/universal-qa"}'),
  ('skill', 'Researcher', 'skill-researcher', 'active', 'marketing', NULL, 'Исследование источников, конкурентов и рынков для маркетингового отдела.', 'Использовать для задач research, source ledger, сравнений и поиска доказательств.', '{"visibility":"department"}'),
  ('skill', 'Frontend design', 'skill-frontend-design', 'active', 'development', NULL, 'Проектирование и проверка интерфейсов Command Center и продуктовых UI.', 'Использовать для UI-задач, визуальной структуры, компонентных экранов и UX-проверки.', '{"visibility":"department"}'),
  ('skill', 'Security review', 'skill-security-review', 'active', 'security', 'security-officer', 'Проверка секретов, доступов, зависимостей и рисков релиза.', 'Использовать как security gate перед публикацией или подключением внешних интеграций.', '{"visibility":"agent"}')
ON CONFLICT (slug) DO UPDATE
SET capability_type = EXCLUDED.capability_type,
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    scope_department = EXCLUDED.scope_department,
    scope_agent = EXCLUDED.scope_agent,
    description = EXCLUDED.description,
    instructions = EXCLUDED.instructions,
    config = EXCLUDED.config,
    updated_at = now();

COMMIT;
