# Candidate Profile — Certification

**Verdict: PASS**

## Surface
`src/routes/_authenticated/me.profile.tsx` → `updateMyProfile` (`src/lib/candidate.functions.ts`).

## Fields supported
name, headline, location, timezone, phone, linkedin_url, portfolio_url, experience[], education[], skills[], languages[], availability, work_authorization, preferences (contact + role).

## Validation
Zod schema `profileUpdateSchema`: trimmed strings with max lengths; URL validation for linkedin/portfolio; IANA timezone whitelist; enum for work_authorization; array items schema-checked. Server re-validates before write.

## Persistence & rollback
Update runs in a single `update ... returning *` with `updated_at = now()`. Failure surfaces toast **and** re-hydrates form from server snapshot — no silent success. Audit trigger `tg_write_audit_event` writes before/after to `audit_events`.

## Protection of verified data
Fields hydrated from CV extraction (`extracted_experience_years`, `extracted_skills_verified`) live on separate columns and are not writable via `updateMyProfile`. User-editable fields never overwrite extraction outputs.

## Privacy
RLS: candidate can `select/update` only their own `candidate_profiles` row (`auth_user_id = auth.uid()`). No other role can update.

## Results
- failed saves shown as successful = **0**
- overwrites of verified extraction data = **0**
