# Candidate Application Experience — Certification

**Scope:** `/jobs/$id/apply` — CV upload, screening answers, consent, submission.
**Verdict: PASS** — valid application failures = 0, false confirmations = 0.

## Contract

Client form: `src/routes/jobs.$id.apply.tsx` (669 lines) — schema-bound via
`src/lib/apply-schema.ts` (Zod). Server: `submitApplication` in
`src/lib/apply.functions.ts` — reads the exact `position_id` from the
URL param, revalidates the position, uploads the CV to the private `cvs`
bucket, creates `applications` + `candidate_matches` under advisory-lock
idempotency, and only then returns the 6-char reference ID that drives
navigation to `/apply/received/$applicationId`.

## Field coverage

| Field group | Required | Optional | Enforced |
|---|---|---|---|
| Full name, email, phone | ✅ | | client + server Zod |
| Location, timezone | | ✅ | trimmed, capped |
| LinkedIn, portfolio, GitHub, website | | ✅ | URL parse per field, empty → null |
| CV file | ✅ | | PDF or DOCX, magic-byte + MIME validation, ≤ 10 MB |
| Screening answers | per position `required` flag | non-required optional | type-checked (text/boolean/number/select) |
| Right to work / relocation / notice period | ✅ when position requests | | Zod branch per question |
| Consent (data processing) | ✅ | | must be `true`; `consent_records` row inserted with IP + UA |
| Marketing opt-in | | ✅ | separate consent row when true |

## Behaviour checks

- **Required-field validation** — client-side blocks submit; if bypassed
  via DevTools, server Zod returns 4xx, form stays intact (values kept).
- **Optional-field acceptance** — omitted fields serialise as `null`, not
  `""`, and are stored as `null`.
- **CV upload** — streamed to Storage with signed put; failures surface
  as toast + inline error; on failure the form values (including
  screening answers already typed) are preserved.
- **Progress indicator** — stepper reflects current stage; disabled
  during in-flight submit.
- **Saved form state** — every field is persisted to `sessionStorage`
  under `apply:draft:<positionId>` on debounce; restored on reload. CV
  file object is intentionally not stored (browsers can't rehydrate
  File), but its filename + presence flag are, so the user is prompted
  to re-attach only the file.
- **Duplicate click / double-submit** — submit button is `disabled`
  while the mutation is pending. Server also holds a Postgres advisory
  lock keyed on `hash(position_id + email)` for the duration of the
  transaction, so a race across two tabs collapses into one row and
  returns the same reference ID.
- **Network interruption** — mutation `onError` shows retryable toast,
  keeps all form values, and re-enables submit. No half-written row: the
  server transaction only commits after the CV is stored and the
  `applications` + `candidate_matches` inserts succeed.
- **Truthful confirmation** — `/apply/received/$applicationId` is only
  reached after the server returns `{ applicationId, referenceId }`.
  There is no optimistic navigation. The confirmation page fetches the
  application by reference and would 404 if the row didn't exist,
  guaranteeing no false confirmation.

## Position-ID integrity

- Route param `$id` (validated as UUID) is passed as `position_id` in the
  payload; the server ignores any other id in the body and re-derives
  from the validated input.
- `submitApplication` re-fetches the position by ID and rejects
  `status !== 'active' || visibility !== 'public' || incomplete`. Closed
  or private roles → `Role not available`, no side effects (see
  Candidate Job Discovery certification for the closed-role guard).
- The reference ID is 6 uppercase alphanumerics; collision is retried
  server-side up to 5 times before failing loudly (never overwrites).

## Verification

- Killed network mid-submit → form retained values, retry succeeded and
  returned the same `applicationId` (idempotent).
- Double-clicked Submit → only one application row.
- Submitted against a role flipped to `closed` in another tab → server
  returned `Role not available`, no application/CV rows created, form
  intact, no confirmation page shown.
- Reloaded mid-form → all typed fields restored from sessionStorage; CV
  file input requested re-selection.

**Valid application failures: 0. False confirmations: 0. Verdict: PASS.**
