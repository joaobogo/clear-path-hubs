-- Audit repair: annotate the support sessions that were created by page
-- navigation alone (no human initiated them). Rows are NOT deleted so the
-- trail stays honest; the reason is prefixed and the sessions are force-ended.
UPDATE public.support_sessions
SET reason = '[SYSTEM-CREATED IN ERROR — no human initiated this session; auto-create-on-navigation defect, fixed 2026-08-17] ' || reason,
    end_reason = COALESCE(end_reason, 'system_created_in_error'),
    ended_at = COALESCE(ended_at, now())
WHERE trace_id IN (
  'sv_sd92a7x9msxorz0m',
  'sv_45mtrk7umsxot4s3',
  'sv_uedds4ojmsxouzvn',
  'sv_oardufglmsxp89dw'
)
AND reason NOT LIKE '[SYSTEM-CREATED IN ERROR%';