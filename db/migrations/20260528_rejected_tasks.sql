BEGIN;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('new', 'planned', 'running', 'blocked', 'review', 'qc', 'done', 'archived', 'cancelled', 'failed', 'rejected'));

COMMIT;
