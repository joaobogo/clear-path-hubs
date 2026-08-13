-- Demo data completeness fill — Northwind Talent (Demo)
create table if not exists public.demo_fill_backup_20260813 (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  row_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

grant all on public.demo_fill_backup_20260813 to service_role;

alter table public.demo_fill_backup_20260813 enable row level security;

drop policy if exists "staff read demo fill backup" on public.demo_fill_backup_20260813;
create policy "staff read demo fill backup"
  on public.demo_fill_backup_20260813
  for select
  to authenticated
  using (public.is_platform_staff(auth.uid()));

do $mig$
declare
  v_org uuid := '0c86fa1b-94ee-46b8-9a11-a42cee39bfed';
  v_engine text := 'demo-coverage-fill-2026-08-13';
  r record;
  v_new_run uuid;
  v_must numeric;
  v_pref numeric;
  v_matched jsonb;
  v_partial jsonb;
  v_missing jsonb;
begin
  if not exists (select 1 from public.organizations where id = v_org) then
    raise notice 'demo org % not present, skipping', v_org;
    return;
  end if;

  insert into public.demo_fill_backup_20260813 (kind, row_id, payload)
  select 'candidate_profile', cp.id, to_jsonb(cp)
  from public.candidate_profiles cp
  where cp.id in (
    select candidate_profile_id from public.candidate_matches where organization_id = v_org
  );

  create temporary table _demo_profile_fill (
    full_name text primary key,
    timezone text,
    region text,
    availability jsonb,
    compensation jsonb,
    certifications jsonb,
    portfolio_url text,
    website_url text,
    summary text
  ) on commit drop;

  insert into _demo_profile_fill values
  ('Ana Ribeiro', 'Europe/Lisbon', 'Lisboa',
   '{"status": "Available in 4 weeks (contractual notice)", "notice_weeks": 4, "earliest_start": "2026-09-14", "note": "Wants to close the current billing migration before handover."}'::jsonb,
   '{"currency": "EUR", "period": "year", "target": 72000, "expected_min": 68000, "expected_max": 76000, "display": "EUR 72,000 base, annual", "note": "Flexible on base if bonus and options are part of the package."}'::jsonb,
   '[{"name": "AWS Certified Solutions Architect - Associate", "issuer": "Amazon Web Services", "date": "2023"}, {"name": "Professional Scrum Developer I", "issuer": "Scrum.org", "date": "2021"}]'::jsonb,
   'https://ana-ribeiro.dev/work', 'https://ana-ribeiro.dev',
   'Nine years in full-stack product work, the last four leading a small squad at Nova Payments. Owns the path from Postgres schema to shipped React interface, and did the ECS and RDS deployment work herself. Strongest on performance: took the merchant dashboard from 2.4s to 780ms at p95. Wants a hybrid Lisbon team where engineers still own product decisions.'),

  ('Beatriz Costa', 'Europe/Lisbon', 'Lisboa',
   '{"status": "Available in 6 weeks (contractual notice)", "notice_weeks": 6, "earliest_start": "2026-09-28", "note": "Handover of the claims platform on-call rotation is the only constraint."}'::jsonb,
   '{"currency": "EUR", "period": "year", "target": 74000, "expected_min": 70000, "expected_max": 78000, "display": "EUR 74,000 base, annual", "note": "Open to the upper half of the published range."}'::jsonb,
   '[{"name": "AWS Certified Developer - Associate", "issuer": "Amazon Web Services", "date": "2022"}]'::jsonb,
   'https://beatrizcosta.pt/projects', 'https://beatrizcosta.pt',
   'Product-minded full-stack engineer, nine years, currently accountable for Vela Insurance''s claims platform end to end - TypeScript across the stack, Postgres, Lambda. Brought in OpenTelemetry tracing and halved incident MTTR. Reads well on regulated data and on writing tests for the parts that page people at night.'),

  ('Carla Nunes', 'Europe/Lisbon', 'Braga',
   '{"status": "Available in 2 weeks", "notice_weeks": 2, "earliest_start": "2026-08-31", "note": "Remote-first from Braga; happy to be in Lisbon two days a month."}'::jsonb,
   '{"currency": "EUR", "period": "year", "target": 65000, "expected_min": 60000, "expected_max": 70000, "display": "EUR 65,000 base, annual", "note": "Values remote flexibility over the top of the range."}'::jsonb,
   '[{"name": "Professional Scrum Developer I", "issuer": "Scrum.org", "date": "2021"}]'::jsonb,
   'https://carlanunes.dev/work', 'https://carlanunes.dev',
   'Seven years building customer-facing web products, frontend-leaning but comfortable in the Node layer and the GraphQL contract between them. Has worked remote-first for four years across distributed teams. Her relational work is mostly MySQL rather than Postgres, which is the one thing to probe.'),

  ('Diogo Silva', 'Europe/Lisbon', 'Lisboa',
   '{"status": "Available immediately", "notice_weeks": 0, "earliest_start": "2026-08-17", "note": "Contract ended in July; interviewing actively."}'::jsonb,
   '{"currency": "EUR", "period": "year", "target": 48000, "expected_min": 44000, "expected_max": 52000, "display": "EUR 48,000 base, annual", "note": "Below the published range; motivated by mentoring and stack breadth."}'::jsonb,
   '[{"name": "MongoDB Certified Developer Associate", "issuer": "MongoDB", "date": "2024"}]'::jsonb,
   'https://diogosilva.build/projects', 'https://diogosilva.build',
   'Four years shipping React and Node.js features in small agency and startup teams. Solid JavaScript, learning TypeScript on the job, and his data work has been MongoDB rather than relational. Would need support on schema design and on the testing discipline this role assumes.'),

  ('Inês Lopes', 'Europe/Madrid', 'Comunidad de Madrid',
   '{"status": "Available in 4 weeks (contractual notice)", "notice_weeks": 4, "earliest_start": "2026-09-14", "note": "Relocating to Lisbon in October; EU citizen, no visa needed."}'::jsonb,
   '{"currency": "EUR", "period": "year", "target": 68000, "expected_min": 62000, "expected_max": 72000, "display": "EUR 68,000 base, annual", "note": "Includes a relocation allowance in her expectation."}'::jsonb,
   '[{"name": "Certified Vue.js Developer", "issuer": "Vue School", "date": "2023"}]'::jsonb,
   'https://ineslopes.dev/case-studies', 'https://ineslopes.dev',
   'Five years full-stack in Madrid product teams, deepest in Vue but has run the last year of new work in React and TypeScript. Strong on Postgres modelling and API design. The move to React is real but recent, so the first months would involve some ramp.'),

  ('Miguel Torres', 'Europe/Lisbon', 'Lisboa',
   '{"status": "Available in 8 weeks (contractual notice)", "notice_weeks": 8, "earliest_start": "2026-10-12", "note": "Long notice period; will not start before mid-October."}'::jsonb,
   '{"currency": "EUR", "period": "year", "target": 78000, "expected_min": 74000, "expected_max": 84000, "display": "EUR 78,000 base, annual", "note": "Above the published range - needs a conversation before an offer."}'::jsonb,
   '[{"name": "HashiCorp Certified: Terraform Associate", "issuer": "HashiCorp", "date": "2024"}, {"name": "AWS Certified Solutions Architect - Associate", "issuer": "Amazon Web Services", "date": "2021"}]'::jsonb,
   'https://migueltorres.engineering/work', 'https://migueltorres.engineering',
   'Eight years across Node.js services and React front ends, with unusually strong infrastructure instincts - Terraform, AWS, CI pipelines he built himself. Test discipline is a stated strength. The gaps are timing (eight weeks of notice) and a salary expectation sitting above the approved range.'),

  ('Pedro Matos', 'Europe/Lisbon', 'Lisboa',
   '{"status": "Available immediately", "notice_weeks": 0, "earliest_start": "2026-08-17", "note": "Freelancing between projects."}'::jsonb,
   '{"currency": "EUR", "period": "year", "target": 32000, "expected_min": 28000, "expected_max": 36000, "display": "EUR 32,000 base, annual", "note": "Well below range, consistent with two years of experience."}'::jsonb,
   '[{"name": "Responsive Web Design Certification", "issuer": "freeCodeCamp", "date": "2024"}]'::jsonb,
   'https://pedromatos.pt/portfolio', 'https://pedromatos.pt',
   'Two years building and maintaining WordPress and PHP sites for local clients, with jQuery front ends and MySQL behind them. Genuinely capable inside that stack, but no commercial TypeScript, React or Postgres work - which is a dealbreaker on this role rather than a ramp-up risk.'),

  ('Rui Fernandes', 'Europe/Lisbon', 'Lisboa',
   '{"status": "Available in 3 weeks", "notice_weeks": 3, "earliest_start": "2026-09-07", "note": "Prefers to finish the current sprint cycle before moving."}'::jsonb,
   '{"currency": "EUR", "period": "year", "target": 62000, "expected_min": 58000, "expected_max": 66000, "display": "EUR 62,000 base, annual", "note": "Sits inside the published range."}'::jsonb,
   '[{"name": "Associate Cloud Engineer", "issuer": "Google Cloud", "date": "2023"}]'::jsonb,
   'https://ruifernandes.dev/work', 'https://ruifernandes.dev',
   'Six years of React and Node.js product work with Postgres behind it, all of it on GCP rather than AWS. Comfortable owning a feature end to end. Testing has been mostly manual on his teams, and he has not worked on multi-tenant isolation - both worth probing early.'),

  ('Sofia Marques', 'Europe/Lisbon', 'Porto',
   '{"status": "Available in 8 weeks (contractual notice)", "notice_weeks": 8, "earliest_start": "2026-10-12", "note": "Based in Porto; can be in Lisbon weekly for the hybrid pattern."}'::jsonb,
   '{"currency": "EUR", "period": "year", "target": 85000, "expected_min": 80000, "expected_max": 92000, "display": "EUR 85,000 base, annual", "note": "Staff-level expectation, materially above the approved range."}'::jsonb,
   '[{"name": "Certified Kubernetes Administrator (CKA)", "issuer": "Cloud Native Computing Foundation", "date": "2023"}, {"name": "AWS Certified Solutions Architect - Professional", "issuer": "Amazon Web Services", "date": "2022"}]'::jsonb,
   'https://sofiamarques.dev/work', 'https://sofiamarques.dev',
   'Ten years, staff-level, TypeScript from database to browser with Next.js and Kubernetes in production. The technical bar is above what this role needs; the practical questions are salary - her expectation is well over the range - and whether a mid-senior scope would hold her interest.'),

  ('Tiago Almeida', 'Europe/Lisbon', 'Lisboa',
   '{"status": "Available in 4 weeks (contractual notice)", "notice_weeks": 4, "earliest_start": "2026-09-14", "note": "No constraints beyond the standard notice."}'::jsonb,
   '{"currency": "EUR", "period": "year", "target": 70000, "expected_min": 66000, "expected_max": 74000, "display": "EUR 70,000 base, annual", "note": "Top of the published range."}'::jsonb,
   '[{"name": "AWS Certified Developer - Associate", "issuer": "Amazon Web Services", "date": "2022"}]'::jsonb,
   'https://tiagoalmeida.dev/work', 'https://tiagoalmeida.dev',
   'Seven years of React, Node.js and Postgres delivery in Lisbon product teams, with Docker and AWS as everyday tools. Reliable end-to-end feature ownership. Has not worked on row-level security or another tenant-isolation model, so that part of the role would be new.');

  update public.candidate_profiles cp
     set timezone = f.timezone,
         region = coalesce(cp.region, f.region),
         availability = coalesce(cp.availability, '{}'::jsonb) || f.availability,
         compensation_preferences = coalesce(cp.compensation_preferences, '{}'::jsonb) || f.compensation,
         certifications = f.certifications,
         portfolio_url = f.portfolio_url,
         website_url = f.website_url,
         summary = f.summary,
         updated_at = now()
    from _demo_profile_fill f
   where cp.full_name = f.full_name
     and cp.id in (
       select candidate_profile_id from public.candidate_matches where organization_id = v_org
     );

  create temporary table _demo_verdict (
    full_name text not null,
    criterion text not null,
    importance text not null,
    verdict text not null,
    primary key (full_name, criterion)
  ) on commit drop;

  insert into _demo_verdict (full_name, criterion, importance, verdict)
  select v.full_name, c.criterion, c.importance, v.verdicts[c.idx]
  from (
    values
      ('Ana Ribeiro',   array['strong','strong','strong','partial','partial','strong','strong','partial','missing','partial']),
      ('Beatriz Costa', array['strong','strong','strong','partial','strong','strong','strong','partial','partial','partial']),
      ('Carla Nunes',   array['strong','partial','strong','missing','partial','strong','partial','strong','missing','missing']),
      ('Diogo Silva',   array['partial','missing','partial','missing','missing','strong','missing','partial','missing','missing']),
      ('Inês Lopes',    array['strong','strong','partial','missing','partial','strong','partial','strong','missing','missing']),
      ('Miguel Torres', array['strong','partial','partial','missing','strong','strong','strong','partial','missing','missing']),
      ('Pedro Matos',   array['missing','partial','missing','missing','missing','strong','missing','missing','missing','missing']),
      ('Rui Fernandes', array['partial','partial','partial','missing','missing','strong','missing','partial','missing','missing']),
      ('Sofia Marques', array['strong','partial','strong','missing','partial','strong','strong','strong','partial','strong']),
      ('Tiago Almeida', array['strong','partial','partial','missing','partial','strong','partial','missing','missing','partial'])
  ) as v(full_name, verdicts)
  cross join (
    values
      (1, '5+ years building production React and TypeScript applications', 'must_have'),
      (2, 'Strong SQL and relational data modelling in Postgres, including migrations', 'must_have'),
      (3, 'Experience owning features end to end, from schema design to shipped UI', 'must_have'),
      (4, 'Practical experience with row-level security or another multi-tenant isolation model', 'must_have'),
      (5, 'Comfortable writing and maintaining automated tests (unit and end-to-end)', 'must_have'),
      (6, 'Fluent written and spoken English', 'must_have'),
      (7, 'Worked on multi-tenant SaaS with per-tenant data isolation', 'preferred'),
      (8, 'Experience in an early-stage or founder-led team', 'preferred'),
      (9, 'Exposure to AI/LLM product features in production', 'preferred'),
      (10, 'Familiarity with TanStack Start, Remix or a similar full-stack React framework', 'preferred')
  ) as c(idx, criterion, importance);

  insert into public.demo_fill_backup_20260813 (kind, row_id, payload)
  select 'evidence_item', i.id,
         jsonb_build_object('result', i.result, 'confidence', i.confidence, 'match_type', i.match_type,
                            'validation_need', i.validation_need)
  from public.candidate_evidence_items i
  where i.organization_id = v_org;

  update public.candidate_evidence_items i
     set result = d.verdict,
         match_type = case when d.verdict = 'missing' then 'missing' else i.match_type end,
         confidence = case d.verdict
                        when 'strong' then 0.910
                        when 'partial' then 0.650
                        else 0.300
                      end,
         validation_need = case when d.verdict = 'missing' then 'no_evidence_in_cv' else i.validation_need end,
         updated_at = now()
    from public.candidate_matches m
    join public.candidate_profiles cp on cp.id = m.candidate_profile_id
    join _demo_verdict d on d.full_name = cp.full_name
   where i.candidate_match_id = m.id
     and d.criterion = i.rubric_criterion_key
     and m.organization_id = v_org;

  for r in
    select m.id as match_id, m.approved_score_run_id, m.current_score_run_id, cp.full_name
    from public.candidate_matches m
    join public.candidate_profiles cp on cp.id = m.candidate_profile_id
    where m.organization_id = v_org
      and m.approved_score_run_id is not null
  loop
    insert into public.demo_fill_backup_20260813 (kind, row_id, payload)
    values ('match_pointers', r.match_id,
            jsonb_build_object('approved_score_run_id', r.approved_score_run_id,
                               'current_score_run_id', r.current_score_run_id));

    select round((count(*) filter (where verdict = 'strong')
                  + 0.5 * count(*) filter (where verdict = 'partial'))::numeric / 6, 4)
      into v_must
      from _demo_verdict where full_name = r.full_name and importance = 'must_have';

    select round((count(*) filter (where verdict = 'strong')
                  + 0.5 * count(*) filter (where verdict = 'partial'))::numeric / 4, 4)
      into v_pref
      from _demo_verdict where full_name = r.full_name and importance = 'preferred';

    select
      coalesce(jsonb_agg(criterion) filter (where verdict = 'strong'), '[]'::jsonb),
      coalesce(jsonb_agg(criterion) filter (where verdict = 'partial'), '[]'::jsonb),
      coalesce(jsonb_agg(criterion) filter (where verdict = 'missing'), '[]'::jsonb)
      into v_matched, v_partial, v_missing
      from _demo_verdict where full_name = r.full_name;

    v_new_run := gen_random_uuid();

    insert into public.score_runs (
      id, candidate_match_id, position_id, organization_id, application_id,
      candidate_profile_id, candidate_submission_id, rubric_version_id,
      engine_version, blueprint_version, evaluation_method,
      score, raw_score, final_score, applied_cap, cap_reason, fit_band, fit_label,
      confidence, evidence_confidence, status, explanation, evidence,
      requirement_coverage, must_have_coverage, preferred_coverage,
      contradiction_status, input_hash, started_at, completed_at, result
    )
    select
      v_new_run, s.candidate_match_id, s.position_id, s.organization_id, s.application_id,
      s.candidate_profile_id, s.candidate_submission_id, s.rubric_version_id,
      v_engine, s.blueprint_version, s.evaluation_method,
      s.score, s.raw_score, s.final_score, s.applied_cap, s.cap_reason, s.fit_band, s.fit_label,
      s.confidence, s.evidence_confidence, s.status, s.explanation, s.evidence,
      coalesce(s.requirement_coverage, '{}'::jsonb)
      || jsonb_build_object(
           'must_have', v_must,
           'preferred', v_pref,
           'matched', v_matched,
           'partial', v_partial,
           'missing', v_missing,
           'requirement_assessment',
             coalesce(
               (select jsonb_agg(
                         (t.elem - 'status')
                         || jsonb_build_object(
                              'status',
                              case d.verdict
                                when 'strong' then 'met'
                                when 'partial' then 'partial'
                                else 'not_evidenced'
                              end)
                         order by t.ord)
                  from jsonb_array_elements(coalesce(s.requirement_coverage->'requirement_assessment','[]'::jsonb))
                         with ordinality as t(elem, ord)
                  join _demo_verdict d
                    on d.full_name = r.full_name
                   and d.criterion = t.elem->>'text'),
               coalesce(s.requirement_coverage->'requirement_assessment', '[]'::jsonb))
         ),
      v_must, v_pref,
      s.contradiction_status, left(coalesce(s.input_hash, '') || 'covfix', 24), s.started_at,
      coalesce(s.completed_at, now()), s.result
    from public.score_runs s
    where s.id = r.approved_score_run_id;

    update public.score_runs
       set superseded_at = now(),
           superseded_by_run_id = v_new_run,
           superseded_reason = 'demo coverage correction 2026-08-13'
     where id = r.approved_score_run_id
       and superseded_at is null;

    update public.candidate_matches
       set approved_score_run_id = v_new_run,
           current_score_run_id = v_new_run,
           updated_at = now()
     where id = r.match_id;
  end loop;
end
$mig$;