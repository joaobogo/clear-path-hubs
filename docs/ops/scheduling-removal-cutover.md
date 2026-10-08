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
