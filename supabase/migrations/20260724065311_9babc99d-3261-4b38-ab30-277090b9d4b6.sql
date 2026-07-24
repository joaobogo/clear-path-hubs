
-- =============================================================
-- PROMPT 2: Rubric architecture extensions
-- =============================================================

-- 1. Add pending_client_approval state to rubric_version_status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                 WHERE t.typname = 'rubric_version_status' AND e.enumlabel = 'pending_client_approval') THEN
    ALTER TYPE public.rubric_version_status ADD VALUE 'pending_client_approval' BEFORE 'approved';
  END IF;
END $$;

-- 2. Rubric templates table (industry + role-family + methodology)
CREATE TABLE IF NOT EXISTS public.rubric_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_type TEXT NOT NULL CHECK (template_type IN ('methodology','industry','role_family')),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  industry TEXT,
  role_family TEXT,
  blueprint JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rubric_templates_type ON public.rubric_templates(template_type, is_active);
CREATE INDEX IF NOT EXISTS idx_rubric_templates_industry ON public.rubric_templates(industry) WHERE industry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rubric_templates_role_family ON public.rubric_templates(role_family) WHERE role_family IS NOT NULL;

GRANT SELECT ON public.rubric_templates TO authenticated;
GRANT ALL ON public.rubric_templates TO service_role;

ALTER TABLE public.rubric_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read active templates"
  ON public.rubric_templates FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_platform_staff(auth.uid()));

CREATE POLICY "platform staff manage templates"
  ON public.rubric_templates FOR ALL
  TO authenticated
  USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE TRIGGER rubric_templates_touch_updated_at
  BEFORE UPDATE ON public.rubric_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 3. Seed the canonical TaaSFlow methodology default (Role Fit 35 / Evidence 30 / Logistics 20 / Signal 15)
INSERT INTO public.rubric_templates (template_type, slug, name, description, blueprint) VALUES
(
  'methodology',
  'taasflow-default-v1',
  'TaaSFlow Evidence-First Default',
  'Canonical evidence-first methodology used across the platform. Role Fit 35%, Evidence 30%, Logistics 20%, Signal 15%. Weights are configurable per role but must total 100 before activation.',
  jsonb_build_object(
    'version', 1,
    'total_weight', 100,
    'dimensions', jsonb_build_array(
      jsonb_build_object(
        'key', 'role_fit',
        'name', 'Role Fit',
        'weight_pct', 35,
        'description', 'Match between candidate experience and the specific responsibilities of this role.',
        'criteria', jsonb_build_array()
      ),
      jsonb_build_object(
        'key', 'evidence',
        'name', 'Evidence',
        'weight_pct', 30,
        'description', 'Documented, verifiable proof of the responsibilities the role requires.',
        'criteria', jsonb_build_array()
      ),
      jsonb_build_object(
        'key', 'logistics',
        'name', 'Logistics',
        'weight_pct', 20,
        'description', 'Location, availability, compensation, work permission, and other hard filters.',
        'criteria', jsonb_build_array()
      ),
      jsonb_build_object(
        'key', 'signal',
        'name', 'Signal',
        'weight_pct', 15,
        'description', 'Soft indicators: engagement quality, communication, motivation, references.',
        'criteria', jsonb_build_array()
      )
    ),
    'anchor_scale', jsonb_build_object(
      'weak', jsonb_build_object('score_min', 0, 'score_max', 33, 'label', 'Weak / missing evidence'),
      'partial', jsonb_build_object('score_min', 34, 'score_max', 66, 'label', 'Partial / transferable evidence'),
      'strong', jsonb_build_object('score_min', 67, 'score_max', 100, 'label', 'Strong / direct evidence')
    ),
    'classifications', jsonb_build_array('must_have','nice_to_have','qualifier','disqualifier')
  )
)
ON CONFLICT (slug) DO UPDATE SET
  blueprint = EXCLUDED.blueprint,
  description = EXCLUDED.description,
  updated_at = now();

-- Industry starter templates (each drafts from the methodology default and highlights vertical-specific criteria)
INSERT INTO public.rubric_templates (template_type, slug, name, description, industry, blueprint) VALUES
(
  'industry', 'medical-writing-v1', 'Medical Writing', 'Regulatory, publication, and scientific communication writing.', 'healthcare',
  jsonb_build_object(
    'inherits', 'taasflow-default-v1',
    'emphasis_criteria', jsonb_build_array(
      'scientific_accuracy','therapeutic_area_depth','authorship_evidence','qc_and_review_ownership',
      'client_relationships','publication_planning','regulatory_compliance','mentoring','scientific_storytelling'
    ),
    'disqualifiers', jsonb_build_array('no_biomedical_background','plagiarism_or_ethics_violation')
  )
),
(
  'industry', 'software-engineering-v1', 'Software Engineering', 'Backend, frontend, platform, and infrastructure engineering roles.', 'technology',
  jsonb_build_object(
    'inherits', 'taasflow-default-v1',
    'emphasis_criteria', jsonb_build_array(
      'systems_design_ownership','shipping_cadence','production_incidents_owned','code_review_leadership',
      'language_and_stack_depth','testing_and_quality','team_impact','open_source_or_publications'
    ),
    'disqualifiers', jsonb_build_array('no_production_shipping_evidence')
  )
),
(
  'industry', 'hospitality-leadership-v1', 'Hospitality Leadership', 'GM, F&B, rooms division, and multi-property operations.', 'hospitality',
  jsonb_build_object(
    'inherits', 'taasflow-default-v1',
    'emphasis_criteria', jsonb_build_array(
      'p_and_l_ownership','guest_satisfaction_metrics','team_size_managed','multi_property_scope',
      'brand_standards_experience','pre_opening_or_transition_experience','revenue_management','union_relations'
    ),
    'disqualifiers', jsonb_build_array('no_management_experience')
  )
)
ON CONFLICT (slug) DO UPDATE SET
  blueprint = EXCLUDED.blueprint,
  description = EXCLUDED.description,
  updated_at = now();

-- =============================================================
-- PROMPT 3: Per-passage evidence + scoring debug telemetry
-- =============================================================

-- 4. candidate_evidence_items — one row per supporting passage
CREATE TABLE IF NOT EXISTS public.candidate_evidence_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_evidence_id UUID NOT NULL REFERENCES public.candidate_evidence(id) ON DELETE CASCADE,
  candidate_match_id UUID NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rubric_criterion_key TEXT NOT NULL,
  rubric_dimension_key TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN (
    'direct','semantic_equivalent','transferable','scale','recency','duration',
    'seniority','outcome','domain_relevance','conflicting','missing'
  )),
  confidence NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_passage TEXT NOT NULL,
  source_location JSONB NOT NULL DEFAULT '{}'::jsonb,
  normalized_meaning TEXT NOT NULL,
  supporting_role TEXT CHECK (supporting_role IN ('used_tool','owned_delivery','led_strategy','observed','mentioned')),
  reviewer_status TEXT NOT NULL DEFAULT 'pending' CHECK (reviewer_status IN ('pending','accepted','rejected','edited')),
  reviewer_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  engine_version TEXT NOT NULL,
  model_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_match ON public.candidate_evidence_items(candidate_match_id);
CREATE INDEX IF NOT EXISTS idx_evidence_items_criterion ON public.candidate_evidence_items(candidate_match_id, rubric_criterion_key);
CREATE INDEX IF NOT EXISTS idx_evidence_items_reviewer ON public.candidate_evidence_items(reviewer_status) WHERE reviewer_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_evidence_items_org ON public.candidate_evidence_items(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_evidence_items TO authenticated;
GRANT ALL ON public.candidate_evidence_items TO service_role;

ALTER TABLE public.candidate_evidence_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org viewers read evidence items"
  ON public.candidate_evidence_items FOR SELECT
  TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
    OR public.is_org_viewer(auth.uid(), organization_id)
  );

CREATE POLICY "org editors review evidence items"
  ON public.candidate_evidence_items FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_staff(auth.uid())
    OR public.is_org_editor(auth.uid(), organization_id)
  )
  WITH CHECK (
    public.is_platform_staff(auth.uid())
    OR public.is_org_editor(auth.uid(), organization_id)
  );

CREATE POLICY "platform staff insert evidence items"
  ON public.candidate_evidence_items FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE POLICY "platform staff delete evidence items"
  ON public.candidate_evidence_items FOR DELETE
  TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE TRIGGER evidence_items_touch_updated_at
  BEFORE UPDATE ON public.candidate_evidence_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 5. scoring_debug_events — admin-only reasoning trace per score_run
CREATE TABLE IF NOT EXISTS public.scoring_debug_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  score_run_id UUID NOT NULL REFERENCES public.score_runs(id) ON DELETE CASCADE,
  candidate_match_id UUID NOT NULL REFERENCES public.candidate_matches(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'criterion_evaluated','evidence_accepted','evidence_rejected','rule_applied',
    'model_call','retry','error','timing','provisional_score','final_score'
  )),
  rubric_criterion_key TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_version TEXT,
  engine_version TEXT NOT NULL,
  duration_ms INTEGER,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debug_events_run ON public.scoring_debug_events(score_run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_debug_events_match ON public.scoring_debug_events(candidate_match_id, created_at);
CREATE INDEX IF NOT EXISTS idx_debug_events_errors ON public.scoring_debug_events(created_at) WHERE event_type = 'error';

GRANT SELECT, INSERT ON public.scoring_debug_events TO authenticated;
GRANT ALL ON public.scoring_debug_events TO service_role;

ALTER TABLE public.scoring_debug_events ENABLE ROW LEVEL SECURITY;

-- Platform staff only — never surfaces to clients or candidates.
CREATE POLICY "platform staff read debug events"
  ON public.scoring_debug_events FOR SELECT
  TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE POLICY "platform staff insert debug events"
  ON public.scoring_debug_events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_staff(auth.uid()));

-- 6. Record evaluation method on score_runs so keyword/semantic/hybrid runs are distinguishable.
ALTER TABLE public.score_runs
  ADD COLUMN IF NOT EXISTS evaluation_method TEXT
    CHECK (evaluation_method IN ('keyword','semantic','hybrid'))
    DEFAULT 'hybrid';

COMMENT ON COLUMN public.score_runs.evaluation_method IS
  'Which evaluation strategy produced this run. Keyword-only is retained for historical reproducibility; new runs default to hybrid semantic evaluation.';

COMMENT ON TABLE public.rubric_templates IS
  'Reusable industry, role-family, and methodology scoring templates. Templates never score directly — they seed rubric_versions drafts, which the client must approve before activation.';

COMMENT ON TABLE public.candidate_evidence_items IS
  'One row per supporting passage. Preserves source location, match type, confidence, normalized meaning, and reviewer status so scoring can be reproduced from stored evidence deterministically.';

COMMENT ON TABLE public.scoring_debug_events IS
  'Admin-only reasoning trace: which criteria were evaluated, why evidence was accepted or rejected, what rule set the provisional score, model/version, timing, retries, errors. Never exposed to clients or candidates.';
