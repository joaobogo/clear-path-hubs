-- 1. Repair rows marked completed with a meeting time AFTER the completion
-- stamp. These read as "already happened" on every timeline while the meeting
-- time sits in the future. The completion stamp is the trustworthy record of
-- when the conversation took place, so the meeting time is pulled back to it.
UPDATE public.interviews
SET scheduled_at = completed_at - interval '60 minutes'
WHERE status = 'completed'
  AND completed_at IS NOT NULL
  AND scheduled_at IS NOT NULL
  AND scheduled_at > completed_at;

-- Completed rows with no meeting time at all cannot be placed on a timeline.
UPDATE public.interviews
SET scheduled_at = completed_at
WHERE status = 'completed'
  AND completed_at IS NOT NULL
  AND scheduled_at IS NULL;

-- 2. Structural guard: a completed interview must have a meeting time, and that
-- time must not be after the moment it was completed.
ALTER TABLE public.interviews
  ADD CONSTRAINT interviews_completed_after_scheduled
  CHECK (
    status <> 'completed'
    OR (
      scheduled_at IS NOT NULL
      AND (completed_at IS NULL OR completed_at >= scheduled_at)
    )
  ) NOT VALID;

ALTER TABLE public.interviews VALIDATE CONSTRAINT interviews_completed_after_scheduled;