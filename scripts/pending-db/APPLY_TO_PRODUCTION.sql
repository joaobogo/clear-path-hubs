-- ============================================================
-- TaaSFlow — migrations committed but NOT yet applied to the
-- production database. Paste into the Supabase SQL editor.
--
-- Safe to re-run. Generated 2026-09-16 from main.
-- ============================================================

-- ---------- 1/3 ----------
-- Lets a client delete their own draft role. Audit #9 item 21.

-- A workspace may delete its own untouched draft role.
--
-- hard_delete_position is staff-only: it raises 'forbidden' unless the actor
-- passes is_platform_staff. deleteWorkspacePosition -- the client-facing Delete
-- button in the role editor -- calls it with the CLIENT's user id, so the
-- button could never work. A client who created a role, mistyped the title and
-- pressed Delete got "forbidden", with no way to remove their own draft.
--
-- The TypeScript handler already narrows this to the safe case, and those
-- checks stay where they are: editor in the workspace, still a draft, no
-- candidate matches attached. The same three conditions are added here IN THE
-- FUNCTION, so the privilege does not rest on the caller being the one
-- well-behaved code path.
--
-- Staff behaviour is unchanged: a platform admin still deletes anything,
-- including submitted roles with candidates, exactly as before. Only the
-- authorisation branch differs from 20260826035339; the deletion body is that
-- migration's, unmodified.

CREATE OR REPLACE FUNCTION public.hard_delete_position(_position_id uuid, _actor_user_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_pos record;
  v_match_ids uuid[] := ARRAY[]::uuid[];
  v_application_ids uuid[] := ARRAY[]::uuid[];
  v_score_run_ids uuid[] := ARRAY[]::uuid[];
  v_match_id uuid;
  v_deleted jsonb := '{}'::jsonb;
BEGIN
  SELECT id, organization_id, title, status INTO v_pos
    FROM public.positions WHERE id = _position_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'position_not_found' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.is_platform_staff(_actor_user_id) THEN
    -- A workspace editor, on their own organisation's role.
    IF NOT public.has_client_permission(
      _actor_user_id, v_pos.organization_id, 'manage_jobs'::client_permission
    ) THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- Drafts only. Anything submitted has been seen by the team, and is
    -- archived rather than deleted.
    IF v_pos.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'position_not_draft' USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- And nothing attached. A role with candidates holds other people's
    -- records; removing it is a staff decision.
    IF EXISTS (SELECT 1 FROM public.candidate_matches WHERE position_id = _position_id) THEN
      RAISE EXCEPTION 'position_has_candidates' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- Collect the match ids up front: holding a cursor open on candidate_matches
  -- while the per-match delete needs to touch that same table aborts the run.
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_match_ids
    FROM public.candidate_matches WHERE position_id = _position_id;

  FOREACH v_match_id IN ARRAY v_match_ids LOOP
    PERFORM public.hard_delete_candidate_match(v_match_id, _actor_user_id, _reason);
  END LOOP;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_application_ids
    FROM public.applications WHERE position_id = _position_id;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_score_run_ids
    FROM public.score_runs WHERE position_id = _position_id;

  ALTER TABLE public.score_runs DISABLE TRIGGER USER;
  ALTER TABLE public.position_versions DISABLE TRIGGER USER;
  ALTER TABLE public.candidate_stage_history DISABLE TRIGGER USER;
  ALTER TABLE public.rubric_versions DISABLE TRIGGER USER;

  DELETE FROM public.scoring_orphans WHERE score_run_id = ANY(v_score_run_ids);
  DELETE FROM public.scoring_debug_events WHERE score_run_id = ANY(v_score_run_ids);
  DELETE FROM public.score_decisions WHERE score_run_id = ANY(v_score_run_ids);
  DELETE FROM public.score_runs WHERE position_id = _position_id;

  DELETE FROM public.candidate_stage_history WHERE position_id = _position_id;
  DELETE FROM public.eligibility_checks WHERE position_id = _position_id;
  DELETE FROM public.hire_records WHERE position_id = _position_id;
  DELETE FROM public.interviews WHERE position_id = _position_id;
  DELETE FROM public.notification_events WHERE position_id = _position_id;
  DELETE FROM public.outreach_touches
    WHERE campaign_id IN (SELECT id FROM public.outreach_campaigns WHERE position_id = _position_id);
  DELETE FROM public.outreach_campaigns WHERE position_id = _position_id;
  DELETE FROM public.role_memory WHERE position_id = _position_id;
  DELETE FROM public.rubric_versions WHERE position_id = _position_id;
  DELETE FROM public.screening_questions WHERE position_id = _position_id;
  DELETE FROM public.shortlist_share_comments
    WHERE share_id IN (SELECT id FROM public.shortlist_shares WHERE position_id = _position_id);
  DELETE FROM public.shortlist_shares WHERE position_id = _position_id;
  DELETE FROM public.talent_memory_events WHERE position_id = _position_id;
  UPDATE public.talent_memory SET source_position_id = NULL WHERE source_position_id = _position_id;
  DELETE FROM public.tasks WHERE position_id = _position_id;
  DELETE FROM public.position_versions WHERE position_id = _position_id;
  DELETE FROM public.intake_submissions WHERE position_id = _position_id;
  DELETE FROM public.application_answers WHERE application_id = ANY(v_application_ids);
  DELETE FROM public.applications WHERE position_id = _position_id;

  DELETE FROM public.processing_jobs WHERE entity_id = _position_id;

  DELETE FROM public.audit_events
    WHERE entity_id = _position_id
       OR entity_id = ANY(v_application_ids)
       OR entity_id = ANY(v_score_run_ids)
       OR before_state @> jsonb_build_object('position_id', _position_id::text)
       OR after_state @> jsonb_build_object('position_id', _position_id::text);

  DELETE FROM public.positions WHERE id = _position_id;

  DELETE FROM public.audit_events
    WHERE entity_id = _position_id
       OR before_state @> jsonb_build_object('position_id', _position_id::text)
       OR after_state @> jsonb_build_object('position_id', _position_id::text);

  ALTER TABLE public.rubric_versions ENABLE TRIGGER USER;
  ALTER TABLE public.candidate_stage_history ENABLE TRIGGER USER;
  ALTER TABLE public.position_versions ENABLE TRIGGER USER;
  ALTER TABLE public.score_runs ENABLE TRIGGER USER;

  v_deleted := jsonb_build_object(
    'position_id', _position_id,
    'organization_id', v_pos.organization_id,
    'title', v_pos.title,
    'match_count', COALESCE(array_length(v_match_ids, 1), 0),
    'application_count', COALESCE(array_length(v_application_ids, 1), 0),
    'score_run_count', COALESCE(array_length(v_score_run_ids, 1), 0),
    'reason', _reason
  );
  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted);
EXCEPTION WHEN OTHERS THEN
  BEGIN
    ALTER TABLE public.rubric_versions ENABLE TRIGGER USER;
    ALTER TABLE public.candidate_stage_history ENABLE TRIGGER USER;
    ALTER TABLE public.position_versions ENABLE TRIGGER USER;
    ALTER TABLE public.score_runs ENABLE TRIGGER USER;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RAISE;
END;
$fn$;
-- ---------- 2/3 ----------
-- Regional consent gate.

-- Regional consent gate: prior opt-in where the law requires it (EU/EEA, UK,
-- Switzerland), optional trackers permitted by default elsewhere.
--
-- The singleton row was seeded with require_prior_opt_in_everywhere = true,
-- which put every visitor on earth behind the EU gate. RB2B and the LinkedIn
-- tag then loaded only for visitors who clicked "Accept all" — on a B2B site,
-- nearly nobody — and RB2B recorded no traffic while the tag was "installed".
-- The published privacy policy has described the regional rule all along; the
-- stored policy and the code default (src/lib/tracking/consent.ts) now agree
-- with it. The switch remains available at /admin/tracking.

alter table public.tracking_policy
  alter column require_prior_opt_in_everywhere set default false;

update public.tracking_policy
   set require_prior_opt_in_everywhere = false,
       updated_at = now()
 where id = true
   and require_prior_opt_in_everywhere = true;


-- ---------- 3/3 ----------
-- Takes demo, QA and internal organisations off the public job board and
-- out of the closed-role page. NOTE: applying this REMOVES the Northwind
-- Talent demo role from /jobs. Confirm you are happy for the board to lose
-- that listing before running it.

-- The public job board keeps the promise its own gate already makes.
--
-- `public_publishable_position_ids` opens with this comment:
--
--   "Public board gate: a role whose owning organization is a test/QA/demo
--    fixture may never be publicly listed or read"
--
-- and then checks only `is_test_record` and `test_run_id`. Demo and QA and
-- internal orgs were never in the WHERE clause, so the stated rule was not the
-- implemented one.
--
-- That gap is load-bearing rather than theoretical, because a separate
-- migration deliberately forces demo organisations to is_test_record = false
-- (20260818214306), and another forces every position inside a demo org to
-- is_test_record = false (20260819235242). A demo workspace could therefore
-- never trip either of the two conditions that were checked.
--
-- The visible consequence: "Senior Full-Stack Engineer — Northwind Talent", a
-- demo tenant's role, was listed on /jobs beside a real one and accepting real
-- applications from real candidates, who would never hear back (audit 17 Sep,
-- item 5).
--
-- Both public readers are corrected here. The second one matters on its own:
-- `public_position_closure` gates on nothing but visibility and status, so a
-- closed demo role was readable even with the listing fixed, and it renders the
-- employer through the name-stripping helper — which launders "(Demo)" out of
-- the organisation name on the way to the page.
--
-- Additive and reversible: no data is written, no row is deleted, and the two
-- function bodies are otherwise their originals.

-- ─── Which roles the public board may list ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.public_publishable_position_ids(_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.positions p
  JOIN public.organizations o ON o.id = p.organization_id
  WHERE p.id = ANY(_ids)
    AND COALESCE(p.is_test_record, false) = false
    AND COALESCE(o.is_test_record, false) = false
    AND o.test_run_id IS NULL
    -- The three the comment always claimed. `is_internal` is not redundant
    -- with the others: the TaaSFlow Platform org carries is_internal = true
    -- and is_test_record = false.
    AND COALESCE(o.is_demo, false) = false
    AND COALESCE(o.is_qa, false) = false
    AND COALESCE(o.is_internal, false) = false
$$;

GRANT EXECUTE ON FUNCTION public.public_publishable_position_ids(uuid[]) TO anon, authenticated, service_role;

-- ─── What a closed public role still reveals ─────────────────────────────────
-- Same predicate, so a demo role cannot be reached through the closed-role
-- page once it is off the board. The LEFT JOIN is kept: a position with no
-- organisation row is not a demo role, and COALESCE lets it through as before.
create or replace function public.public_position_closure(_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'status', p.status::text,
    'organization_name',
      case when coalesce(p.intake_context->'posting'->>'confidentiality','') = 'confidential'
        then 'Confidential employer' else coalesce(o.name, 'TaaSFlow client') end
  )
  from public.positions p
  left join public.organizations o on o.id = p.organization_id
  where p.id = _id
    and p.visibility = 'public'
    and p.status in ('paused','filled','closed','archived')
    and coalesce(o.is_test_record, false) = false
    and o.test_run_id is null
    and coalesce(o.is_demo, false) = false
    and coalesce(o.is_qa, false) = false
    and coalesce(o.is_internal, false) = false
$$;

grant execute on function public.public_position_closure(uuid) to anon, authenticated, service_role;
