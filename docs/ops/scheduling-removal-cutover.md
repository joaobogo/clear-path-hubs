# Scheduling removal: cutover notes

TaaSFlow no longer schedules interviews. The client and the candidate arrange them directly, outside the product. This note covers what changed, how to find interviews that were still in flight, and a reviewed script to close them. Nothing in the code release touches the database; the SQL below is for the owner to run by hand.

## 1. What changed for users

Clients
- "Request interview" is now "Move to interview stage". It records the stage and the decision. It does not create an interview, propose times or notify the candidate by email.
- /client/interviews is a record of past interviews and a feedback list. There is no availability, no "propose times" and no confirm/cancel/reschedule.
- Feedback and scorecards can be recorded for any candidate at the interview stage. The first submission creates one completed interview record (once; a retry reuses it).
- "Interviews" figures count candidates who reached the interview stage plus older interview records, once per candidate. They are no longer labelled "held".
- The "Book a call" links in the workspace are gone.

Candidates
- No "pick a time", "confirm slot" or availability preference. The application page says: "The employer will contact you directly to arrange the interview."
- An interview booked earlier and still in the future appears read-only under "Your interview" (date, time zone, join link if one was stored).

Staff
- Calendly webhook panel, interview-exceptions panel, "Interviews to coordinate" tile, the admin Interviews page and the "Interview slots" SLA commitment are removed.
- The booking reminder, interview reminder and Calendly webhook endpoints still answer 200 with `{"ok":true,"disabled":true,"reason":"scheduling removed"}`, so any external scheduler or webhook keeps getting a success. They do nothing.

## 2. Read-only: open legacy interviews

```sql
-- Open interviews that were still in flight, with who is affected.
select i.id                         as interview_id,
       i.status,
       i.scheduled_at,
       i.meeting_url,
       o.name                       as client,
       p.title                      as role,
       cp.full_name                 as candidate,
       cp.email                     as candidate_email
from public.interviews i
join public.candidate_matches m   on m.id = i.candidate_match_id
join public.organizations o       on o.id = i.organization_id
join public.positions p           on p.id = i.position_id
join public.candidate_profiles cp on cp.id = m.candidate_profile_id
where i.status in ('requested', 'scheduling', 'scheduled')
  and (i.status <> 'scheduled' or i.scheduled_at > now())
order by i.scheduled_at nulls first, o.name;
```

Rows with `status = 'scheduled'` and a future `scheduled_at` are real appointments. Contact those people first (section 4) and only close the row after the interview date has passed, or after both sides know it is now off system. Rows still `requested` or `scheduling` have no confirmed time.

## 3. Reviewed script: close open legacy rows

Review before running. It defaults to ROLLBACK. Change the last line to COMMIT only after the printed counts look right. It does not touch scheduled rows with a future time unless you uncomment the marked line.

```sql
begin;

-- Which rows are closed. Edit the filter on purpose, not by accident.
create temp table _close_ids on commit drop as
select i.id, i.candidate_match_id
from public.interviews i
where i.status in ('requested', 'scheduling')            -- no confirmed time
   -- or (i.status = 'scheduled' and i.scheduled_at <= now())  -- uncomment: past, never closed
;

select count(*) as rows_to_cancel from _close_ids;

update public.interviews
   set status = 'cancelled',
       cancel_reason = 'Scheduling removed from TaaSFlow; interview arranged directly',
       cancelled_at = now(),
       updated_at = now()
 where id in (select id from _close_ids)
   and status in ('requested', 'scheduling', 'scheduled');   -- lifecycle trigger allows these -> cancelled

-- Resolve stale "interview requested/rescheduled" notifications on those matches.
update public.notifications
   set resolved_at = now(),
       read_at = coalesce(read_at, now())
 where resolved_at is null
   and event_type in ('interview_requested', 'interview_rescheduled')
   and entity_type = 'candidate_match'
   and entity_id in (select candidate_match_id from _close_ids);

-- Count check: nothing in the close list may still be open.
select count(*) as still_open
  from public.interviews
 where id in (select id from _close_ids)
   and status in ('requested', 'scheduling', 'scheduled');
-- Expect 0. If not, stop and investigate.

rollback;   -- change to: commit;  only after the counts above are as expected
```

Cancelled rows keep their history. Candidates stay at the interview stage; only the dead scheduling record is closed.

## 4. Suggested one-off message

To clients with an open interview:

> Subject: Interviews are now arranged directly with your candidate
>
> TaaSFlow no longer schedules interviews. You and the candidate arrange them directly, outside TaaSFlow. Your candidate list, stages and feedback are unchanged. If an interview was already booked through TaaSFlow, it still stands; please confirm the details with the candidate directly. You can still record feedback on the candidate's page after you have spoken.

To candidates with an open interview:

> Subject: Your interview
>
> TaaSFlow no longer schedules interviews. The employer will contact you directly to arrange the interview. If you already had a time agreed, it still stands. If you are unsure, reply to the employer's last message.

## 5. Checklist

Before deploy
- [ ] Run the section 2 query and save the result.
- [ ] Send the section 4 messages to the people with a future `scheduled` interview.
- [ ] Confirm the external scheduler (pg_cron or similar) calling the reminder endpoints uses the cron secret; it will keep getting 200s.
- [ ] Confirm nobody relies on the Calendly webhook; the endpoint just accepts and ignores events.

After deploy
- [ ] Open a client workspace: move a test candidate to the interview stage; the Interviews page lists it under feedback.
- [ ] Submit feedback twice; confirm one completed `interviews` row exists for the match.
- [ ] Check a candidate application with a future legacy interview shows "Your interview".
- [ ] Run the section 3 script with ROLLBACK, read the counts, then re-run with COMMIT.
- [ ] Re-run the section 2 query; only future `scheduled` appointments should remain.

## 6. Optional hardening: close direct inserts

Status: NOT applied. Nothing in the code release depends on it. Apply only after review.

### The gap

The application never creates a `requested`, `scheduling` or `scheduled` interview for a client. The remaining exposure is the database itself. Policy `iv_write` (supabase/migrations/20260726193334_ea342394-342a-4dd8-9a76-7445a86babe4.sql) is `FOR ALL TO authenticated`, and `authenticated` holds `INSERT, UPDATE, DELETE` on `public.interviews`. A signed-in client user who has the `request_interviews` permission and can see the match could therefore call the Supabase client directly with their own JWT and insert a row with status `requested`, `scheduling` or `scheduled`, or move a row between those states. That would not be reachable from any screen, but the product owner asked for no way at all.

Why a plain `WITH CHECK (status <> 'scheduled')` does not work: the feedback flow (src/lib/interview-record.server.ts) runs on the caller's JWT. It inserts with status `scheduled` (the lifecycle trigger `tg_interviews_lifecycle` forbids inserting `completed`, and requires `scheduled_at` for `scheduled`), then updates to `completed`. Scorecard and feedback submission (src/lib/scorecards.functions.ts, src/lib/interview-feedback.functions.ts) also update `scheduled` to `completed`. Blocking `scheduled` on the table would break feedback.

### Design

1. A `SECURITY DEFINER` function `public.record_completed_interview(_match uuid)` is the only way a client user creates an interview row. It inserts as `scheduled` and updates to `completed` inside one call, so the row never rests in `scheduled`, and it returns the row id. Reuse of an existing row for the match stays in application code.
2. Client roles lose direct `INSERT` and `DELETE` on `interviews`. `UPDATE` stays only for the `scheduled -> completed` step on legacy rows, enforced by policy.
3. Platform staff keep full access (they are covered by the separate staff branch, and `service_role` is unaffected).

### Migration (review, then run by hand)

```sql
BEGIN;

-- 1) The only client-reachable way to create an interview row.
CREATE OR REPLACE FUNCTION public.record_completed_interview(_match uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_m   record;
  v_id  uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.is_active_user(v_uid) THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT id, organization_id, position_id, application_id, stage, client_visibility
    INTO v_m
    FROM public.candidate_matches
   WHERE id = _match;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  IF NOT (public.is_platform_staff(v_uid)
          OR (public.is_match_client_visible(v_uid, _match)
              AND public.has_client_permission(v_uid, v_m.organization_id, 'request_interviews'))) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Feedback is only for candidates at or past the interview stage.
  IF v_m.client_visibility IS DISTINCT FROM 'visible'
     OR v_m.stage::text NOT IN ('interview_process','offer','hired','not_moving_forward') THEN
    RAISE EXCEPTION 'match_not_at_interview_stage';
  END IF;

  -- One active row per match already exists? Return it (unique index interviews_active_per_match_uq).
  SELECT id INTO v_id FROM public.interviews
   WHERE candidate_match_id = _match AND status IN ('requested','scheduling','scheduled')
   LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.interviews
      (candidate_match_id, organization_id, position_id, candidate_submission_id,
       status, scheduled_at, requested_at, created_by)
    VALUES
      (_match, v_m.organization_id, v_m.position_id, v_m.application_id,
       'scheduled', now(), now(), v_uid)
    RETURNING id INTO v_id;
  END IF;

  UPDATE public.interviews
     SET status = 'completed', completed_at = now(), updated_by = v_uid
   WHERE id = v_id AND status = 'scheduled';

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.record_completed_interview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_completed_interview(uuid) TO authenticated, service_role;

-- 2) Replace the FOR ALL write policy with staff-only writes plus a narrow client UPDATE.
DROP POLICY IF EXISTS iv_write ON public.interviews;

CREATE POLICY iv_staff_write ON public.interviews
  FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

-- Clients may only close an existing row: scheduled -> completed. They cannot insert,
-- delete, or move a row into requested/scheduling/scheduled.
CREATE POLICY iv_client_complete ON public.interviews
  FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid())
         AND status = 'scheduled'
         AND public.is_match_client_visible(auth.uid(), candidate_match_id)
         AND public.has_client_permission(auth.uid(), organization_id, 'request_interviews'))
  WITH CHECK (status IN ('completed','cancelled')
              AND public.is_match_client_visible(auth.uid(), candidate_match_id)
              AND public.has_client_permission(auth.uid(), organization_id, 'request_interviews'));

-- 3) No direct INSERT or DELETE for signed-in users. The SECURITY DEFINER function
--    above runs as its owner and is unaffected by this REVOKE.
REVOKE INSERT, DELETE ON public.interviews FROM authenticated;

COMMIT;
```

Notes for the reviewer
- Run it first in a staging project. Check that `is_active_user`, `is_platform_staff`, `is_match_client_visible` and `has_client_permission` have the signatures used in the file above (they do in the migrations referenced).
- The function must be owned by a role that can insert into `interviews` (the default migration owner `postgres` can). The existing triggers (`interviews_lifecycle`, `trg_interviews_status_history`, `audit_interviews`) still fire.
- Staff-side code that writes `interviews` through the user's JWT keeps working through `iv_staff_write`. The `REVOKE INSERT` above would block it, so if any staff screen inserts as `authenticated`, either keep the grant and rely on policies (drop the `REVOKE` line; the policies alone already remove client inserts) or route it through `service_role`. The code audit found no staff insert path, only `interview-record.server.ts`.
- Rollback: `BEGIN; DROP POLICY iv_client_complete ON public.interviews; DROP POLICY iv_staff_write ON public.interviews; GRANT INSERT, DELETE ON public.interviews TO authenticated; <recreate iv_write from 20260726193334>; DROP FUNCTION public.record_completed_interview(uuid); COMMIT;`

### Code change that goes with it

Apply this together with, not before, the migration:

- src/lib/interview-record.server.ts, function `ensureCompletedInterviewForMatch`: in the `plan.kind === "create"` branch, replace the `insert(...)` followed by `step(created.id, "completed")` with `supabase.rpc("record_completed_interview", { _match: matchId })`, and use the returned id. Keep the `match_not_at_interview_stage` check and the `plan.kind === "reuse"` branch (which only ever updates an existing `scheduled` row to `completed`, allowed by `iv_client_complete`).
- src/integrations/supabase/types.ts will need the new function in `Functions` (regenerate types; do not hand-edit).
- Until the migration is applied, do NOT ship the rpc call: the function would not exist and feedback would fail.

### Residual risk until applied

A client user with `request_interviews` can create or move an `interviews` row to `requested`/`scheduling`/`scheduled` with a hand-built Supabase call. Effects are limited to that organisation's own match: the row is visible on /client/interviews and counts in interview figures. The application sends no email, notification or candidate-facing message from such a row, because every scheduling notification path is retired (`RETIRED_SCHEDULING_EVENTS` in src/lib/events.ts) and the reminder endpoints are inert.
