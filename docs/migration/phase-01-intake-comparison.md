# Phase 01 — Intake Comparison

## Original: `/pilot/intake` → `src/pages/PilotIntake.tsx` (2027 lines)
- 6 visible steps: **Role Definition, Hiring Contact, Candidate Profile, Compensation, Search Criteria, Review & Submit**
- Rich sub-components: `IntakeProgress`, `BlueprintPreview`, `TagInput`, `CityAutocomplete`, `CountryAutocomplete`, `CompensationField`, `IntakeAttachmentsField`, `DraftSaveIndicator`, `DraftRecoveryBanner`, `OnboardingBreadcrumb`, `AiSuggestion`/`AutofillSummary`, `JdParseReviewModal`
- Submission handler: `invokeFriendly(supabase.functions, "submit-intake", …)` (public `verify_jwt = false` edge function)
- Anonymous submissions supported: `submit-intake` provisions the account server-side, eliminating the old signup→submit 600ms race (`InlineAccountCreate` was intentionally removed)
- Status polling: `get-intake-status` (public edge fn)
- Admin repair mode: `AdminEditBanner` when re-opening an intake for repair
- JD ingestion: `parse-jd` + `JdParseReviewModal`; role blueprint generation via `generate-role-blueprint` (surfaced as `BlueprintPreview`)
- Screening question generation: `generate-screening-questions`
- Draft persistence: `localStorage['taasflow_intake_draft']`
- Analytics: `trackEvent`
- Login recovery mid-form: `LoginModal`
- Consent capture on Step 2

### Original field set (`IntakeFormData` from `src/lib/intake-types.ts` — inferred from imports)
Contact/company: `firstName, lastName, workEmail, phone, companyName, companyWebsite, companySize, hqLocation, hiringUrgency, consent, companyType`
Role: `roleTitle, roleType, workModel, timezonePreference[], seniorityLevel, headcountNeeded, experienceRange, startWindow`
Candidate profile: skills, qualifications (via `TagInput`), preferred/dealbreaker requirements
Compensation: `currency`, salary range, structure (via `CompensationField`)
Search criteria: target countries, target titles, filters (via `Country/CityAutocomplete`)
Attachments: `IntakeAttachmentsField` (JD upload)
Enums: `COMPANY_SIZES, HIRING_URGENCIES, ROLE_TYPES, WORK_MODELS, SENIORITY_LEVELS, HEADCOUNT_OPTIONS, START_WINDOWS, EXPERIENCE_RANGES, COMPANY_TYPES, TIMEZONES, CURRENCIES`

### Known failure points (per prior audits + user history)
- Legacy signup-race with `InlineAccountCreate` (retired)
- Position/client duplicate writes across multiple code paths
- Long-form failure surfaced only via toast; no persistent retry payload before `persistRetryPayload` was introduced

## New: `/intake` → `src/routes/intake.tsx` + `POST /api/public/intake`
- 5 steps: **Contact & company, Role overview, Requirements, Hiring context, Review & submit**
- Zod contract: `src/lib/intake-schema.ts` → `intakeSchema` + `IntakeInput`
- Draft key: `taasflow.intake.draft.v1`; idempotency key: `taasflow.intake.idem.v1`
- Server: `src/routes/api/public/intake.ts` — single transactional POST; `submit-intake` equivalent
- Draft saving + resume
- 100% wired to canonical services (Phase 4)

### New field set (from `intake-schema.ts`)
Required: `firstName, lastName, workEmail, companyName, roleTitle, workModel ∈ {remote,hybrid,onsite}, consent=true`
Optional: `location, employmentType, seniority, jobDescription (≤20k chars), preferredRequirements (≤4k), dealbreakers (≤2k), targetCountries[≤30], compensation, headcount (int 1–999), hiringUrgency, targetTitles[≤30], workAuthorization`
Cross-field: at least 3 must-have skills OR a job description ≥40 chars.

## Field mapping (original → new canonical)

| Original field | New canonical | Decision |
|---|---|---|
| firstName | firstName | keep, required |
| lastName | lastName | keep, required |
| workEmail | workEmail | keep, required |
| phone | *(not present)* | **needs product decision** — add as optional string? |
| companyName | companyName | keep, required |
| companyWebsite | *(not present)* | **needs decision** — add as optional url |
| companySize | *(not present)* | **needs decision** — add enum (5–10 / 11–50 / …); useful for tiering |
| companyType | *(not present)* | needs decision |
| hqLocation | *(not present)* | merge with `location`? decision |
| hiringUrgency | hiringUrgency | keep, optional |
| consent | consent | keep, required=true |
| roleTitle | roleTitle | keep, required |
| roleType | employmentType | rename (`full_time / contract / …`) |
| workModel | workModel | keep, required, enum-locked |
| timezonePreference[] | *(not present)* | needs decision (targetCountries partly covers) |
| seniorityLevel | seniority | rename |
| headcountNeeded | headcount | rename |
| startWindow | *(not present)* | needs decision — add optional string/enum |
| experienceRange | *(not present)* | needs decision — merge into preferredRequirements or add scalar |
| skills (TagInput) | mustHaveSkills[] | keep (already required-alternative via refine) |
| preferredRequirements (freeform) | preferredRequirements | keep |
| dealbreakers | dealbreakers | keep |
| currency / salary range | compensation (single string) | **new is too coarse** — decision: promote to structured `{ currency, min, max, structure }` |
| targetCountries[] | targetCountries[] | keep |
| targetTitles[] | targetTitles[] | keep |
| workAuthorization | workAuthorization | keep |
| JD upload / parse | *(not present)* | **rebuild** — add JD upload, then reuse new `cv-extractor` + Gemini pipeline for JD parsing; surface `JdParseReviewModal` equivalent |
| generate-screening-questions | *(not wired)* | **rebuild** — generate structured screening questions server-side after Step 5 and persist to `screening_questions` |
| generate-role-blueprint | *(not wired)* | **rebuild** — needed for scoring blueprint |
| Admin repair mode | *(not present)* | **add** — mirror `AdminEditBanner` + repair route |
| Login recovery mid-form (`LoginModal`) | *(not present)* | needs decision |
| Draft key `taasflow_intake_draft` | `taasflow.intake.draft.v1` | keep new key; do not import legacy drafts |
| Confirmation page | `/intake/confirmation` | keep new |

### Merged product direction (locked)
- Preserve original questions and hiring-context depth (add missing fields listed above).
- Keep new 5-step working interface + new server-side transactional submission.
- Do not copy `submit-intake`'s edge-fn code path; keep the `POST /api/public/intake` route.
- Prevent duplicate position/client writes via existing idempotency key.
- Rebuild JD parsing + role blueprint + screening-question generation inside the new pipeline runner using Gemini (already available in `cv-hydration.server.ts`).

## Field-mapping JSON — see `phase-01-findings.json` → `intake_field_map`.
