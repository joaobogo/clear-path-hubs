
-- Extend tasks table with first-class workflow fields
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'general_follow_up',
  ADD COLUMN IF NOT EXISTS blocking boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_policy text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS completion_evidence text,
  ADD COLUMN IF NOT EXISTS approved_version_hash text,
  ADD COLUMN IF NOT EXISTS collaborators uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- Validate task_type against canonical set
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_task_type_chk;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_task_type_chk CHECK (task_type IN (
  'role_brief_approval','rubric_approval','candidate_review','interview_scheduling',
  'feedback_submission','compensation_confirmation','offer_decision','document_request','general_follow_up'
));

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_reminder_policy_chk;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_reminder_policy_chk CHECK (reminder_policy IN ('none','daily','weekly','before_due'));

-- Idempotency: unique per org on optional metadata.idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS tasks_idempotency_uq
  ON public.tasks (organization_id, (metadata->>'idempotency_key'))
  WHERE metadata ? 'idempotency_key' AND deleted_at IS NULL;

-- Fast filters for blocking/overdue lookups
CREATE INDEX IF NOT EXISTS idx_tasks_blocking
  ON public.tasks (organization_id, status)
  WHERE blocking = true AND deleted_at IS NULL AND status IN ('open','in_progress');

CREATE INDEX IF NOT EXISTS idx_tasks_completed
  ON public.tasks (organization_id, completed_at DESC)
  WHERE status = 'done' AND deleted_at IS NULL;
