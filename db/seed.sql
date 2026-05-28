INSERT INTO route_rules (route_type, name, department, primary_agent, qc_required, approval_required, definition)
VALUES
  ('feature_development', 'Feature development', 'development', 'dev-builder', true, false, '{"workflow":"workflows/feature-development.md","next":["dev-reviewer","qa-lead","materials-librarian"]}'),
  ('bugfix', 'Bug fix', 'development', 'dev-builder', true, false, '{"workflow":"workflows/bugfix.md","next":["dev-reviewer","qa-lead"]}'),
  ('qa_review', 'QA review', 'quality-control', 'qa-lead', true, false, '{"workflow":"workflows/qa-review.md","tools":["universal-qa"]}'),
  ('material_save', 'Material save', 'materials-library', 'materials-librarian', false, false, '{"workflow":"workflows/material-lifecycle.md"}'),
  ('daily_audit', 'Daily audit', 'quality-control', 'daily-auditor', false, false, '{"workflow":"workflows/daily-audit.md"}'),
  ('content_production', 'Content production', 'marketing', 'seo-strategist', true, true, '{"workflow":"workflows/content-production.md","next":["marketing-researcher","content-writer","seo-strategist","qa-lead","materials-librarian"]}'),
  ('seo_brief', 'SEO brief', 'marketing', 'seo-strategist', false, false, '{"workflow":"workflows/content-production.md"}'),
  ('marketing_research', 'Marketing research', 'marketing', 'marketing-researcher', true, false, '{"workflow":"workflows/content-production.md"}'),
  ('content_rewrite', 'Content rewrite', 'marketing', 'content-writer', true, false, '{"workflow":"workflows/content-production.md","next":["seo-strategist","qa-lead"]}'),
  ('seo_review', 'SEO review', 'marketing', 'seo-strategist', false, false, '{"workflow":"workflows/content-production.md"}'),
  ('ad_campaign', 'Ad campaign', 'marketing', 'ads-specialist', true, true, '{"workflow":"workflows/ad-campaign.md","tools":["yandex-metrica","yandex-direct","yandex-webmaster"],"next":["security-officer","qa-lead"]}'),
  ('security_review', 'Security review', 'security', 'security-officer', true, false, '{"workflow":"workflows/security-review.md"}'),
  ('release_security_gate', 'Release security gate', 'security', 'security-officer', true, true, '{"workflow":"workflows/security-review.md","next":["qa-lead"]}')
ON CONFLICT (route_type) DO UPDATE
SET name = EXCLUDED.name,
    department = EXCLUDED.department,
    primary_agent = EXCLUDED.primary_agent,
    qc_required = EXCLUDED.qc_required,
    approval_required = EXCLUDED.approval_required,
    definition = EXCLUDED.definition,
    updated_at = now();

INSERT INTO tasks (owner_request, status, route_type, assigned_department, assigned_agent, priority, risk_level, acceptance_criteria, metadata)
VALUES (
  'Seed task: verify AI Dev Office executable MVP scaffolding.',
  'planned',
  'qa_review',
  'quality-control',
  'qa-lead',
  'normal',
  'low',
  '["Postgres schema loads", "Route rules exist", "Codex CLI wrappers support dry-run", "Universal QA lists checks"]',
  '{"seed":true}'
)
ON CONFLICT DO NOTHING;
