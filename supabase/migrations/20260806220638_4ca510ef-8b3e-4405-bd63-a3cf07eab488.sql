-- Requirement-level human overrides are recorded in the same append-only
-- history as evidence-item overrides. A reviewer can mark a requirement met,
-- not met or not applicable even when no extracted evidence row exists for it,
-- so the link to an evidence item becomes optional.
-- Rollback: UPDATE public.evidence_overrides SET evidence_item_id = ... (or
-- delete requirement-level rows) then
-- ALTER TABLE public.evidence_overrides ALTER COLUMN evidence_item_id SET NOT NULL;
ALTER TABLE public.evidence_overrides ALTER COLUMN evidence_item_id DROP NOT NULL;

COMMENT ON COLUMN public.evidence_overrides.evidence_item_id IS
  'Evidence item this override targets. NULL when the reviewer overrode a requirement that has no extracted evidence row; before_state/after_state then carry requirement_id.';