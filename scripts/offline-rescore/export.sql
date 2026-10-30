-- Inputs for an offline rescore of one position (replace the id).
-- Returns one JSON document; save it and pass it to run.ts.
with p as (select * from positions where id = '228cd1ec-1ec1-4205-828c-7a92b1be42e1')
select json_build_object(
  'position', json_build_object('id', p.id, 'requirements', p.requirements, 'preferred_requirements', p.preferred_requirements),
  'rubric', (select json_build_object('id', rv.id, 'calibration', rv.calibration) from rubric_versions rv
             where rv.position_id = p.id and rv.status in ('approved', 'active') and rv.superseded_at is null
             order by rv.version_number desc limit 1),
  'role_family', public.role_family_of(p.title),
  'matches', (select json_agg(json_build_object(
      'match_id', m.id, 'application_id', m.application_id, 'candidate_profile_id', m.candidate_profile_id,
      'position_id', m.position_id, 'organization_id', m.organization_id,
      'eligibility_status', m.eligibility_status, 'cv_text', f.extracted_text,
      'location', cp.location, 'city', cp.city, 'country', cp.country,
      'answers', (select coalesce(json_agg(json_build_object('question_id', a.question_id, 'answer', a.answer,
                    'q', json_build_object('question', q.question, 'answer_type', q.answer_type, 'required', q.required,
                         'dealbreaker', q.dealbreaker, 'preferred_answer', q.preferred_answer, 'must_have', q.must_have))), '[]')
                  from application_answers a left join screening_questions q on q.id = a.question_id
                  where a.application_id = m.application_id))
    order by m.created_at)
    from candidate_matches m
    join candidate_profiles cp on cp.id = m.candidate_profile_id
    left join files f on f.id = cp.current_cv_file_id
    where m.position_id = p.id and not coalesce(m.is_test_record, false))
) doc from p;
