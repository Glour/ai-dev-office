BEGIN;

CREATE TABLE IF NOT EXISTS office_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  secret_type TEXT NOT NULL DEFAULT 'generic' CHECK (secret_type IN ('generic', 'login', 'api_key', 'ssh_key', 'token', 'cookie', 'env')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'archived')),
  scope_department TEXT,
  scope_agent TEXT,
  description TEXT NOT NULL DEFAULT '',
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'aes-256-gcm',
  key_id TEXT NOT NULL DEFAULT 'command-center-v1',
  fingerprint TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_office_secrets_status_type ON office_secrets (status, secret_type);
CREATE INDEX IF NOT EXISTS idx_office_secrets_scope ON office_secrets (scope_department, scope_agent);

COMMIT;
