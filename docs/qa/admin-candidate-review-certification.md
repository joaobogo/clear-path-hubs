# Admin Candidate Review — Certification

**Verdict: PASS** — duplicate candidate-review surfaces = 0, missing review data = 0.

## Single canonical surface

The Admin candidate review lives at exactly one route:

- `src/routes/_authenticated/admin.candidates.$id.tsx` (1,333 lines).

Discovery of alternative surfaces:

- `admin.candidates.index.tsx` — list only, links into `$id`.
- `admin.candidates.tsx` — pathless layout wrapper (Outlet).
- Client-side counterpart `client.candidates.$id.tsx` is a separate audience
  view (approved-only, no processing tools). It reads the same match through
  RLS-gated Client fetchers and is not a duplicate review surface.
- No detail drawer, sheet, or modal exposes the same fields on any other
  Admin route — `CandidateDetailDrawer` from the earlier prototype is no
  longer referenced from Admin routes.

Result: **one review page, one URL, one code path.**

## Sections rendered (all 14 required, verified in source)

| Contract section | Location in file |
| --- | --- |
| Profile (`Candidate profile` block, incl. status, tags) | line 345 |
| CV file (download, filename, uploaded_at) | Files/Downloads column + `DownloadCvButton` |
| Parsed data (`Extracted text`, skills, languages, experience, education) | 424, 466, 479, 489, 510 |
| Enrichment (Skills / Languages / Experience / Education from hydration) | 466–510 |
| Evidence (per-requirement, with matched_terms + snippet + location) | 691 (requirement assessment table) |
| Score (`Fit score`, must-have %, preferred %, screening alignment) | 635 |
| Score categories (`must_have`, `preferred`, `screening_alignment`) | 635 breakdown |
| Contradictions (banner + Contradiction row) | 542, 547, 698 |
| Screening answers (per-question with alignment) | 653 |
| Score history (all runs with completed_at, engine_version) | 781 |
| Processing history (`processing_jobs`) | 800 |
| Client Preview (`getClientPreview` renders the exact client-facing card) | 889 (`ClientPreviewCard`) |
| Publication state (`visibility: {m.client_visibility}` badge + Publish/Unpublish action) | 285, 1030 |
| Audit (`ActivityAuditTab` reading `audit_events` scoped to the match) | 220, 926 |

Support blocks also present: `Other applications by this candidate` (382),
`Decisions` (836), `Next step` context panel (1085), `Review notes` (1237),
`Attach OCR text` (1288). None reproduce the review sections above.

## Context-aware primary action

The page renders a **single** primary action that adapts to the current
processing / admin state (visible in the header / Next Step panel). The
options are mutually exclusive by state:

| Match state | Primary action |
| --- | --- |
| `queued` / `parsing` | Wait (no primary; secondary: `retryParse`) |
| `ocr_required` | `Attach OCR text` |
| `parsed` / `enriching` | `Retry hydration` / `Retry enrichment` |
| `ready_to_score` | `Run scoring` (invokes `rescore`) |
| `scored` + not published | **Publish to client** (calls `assertPublishGate` → `setMatchClientVisibility`) |
| `scored` + published | **Unpublish** (`setMatchClientVisibility('hidden')`) |
| `manual_review_required` | `Apply decision` (`applyReviewDecision`) |
| `failed` | `Retry pipeline` (`advanceProcessing`) |

Secondary actions (rescore, retry parse, retry hydration, download CV, view
public application) live behind a single `MoreHorizontal` dropdown — never
competing with the primary CTA.

## Data completeness

`getAdminMatch` (loader) returns a single DTO carrying every field the
review page needs:

- match core (`id, stage, admin_status, client_visibility, processing_state,
  processing_error_code, processing_error_message, updated_at`)
- candidate profile (with `consent.provenance`, `consent.locked_fields`,
  hydration-produced skills / languages / experience / education)
- application answers with joined `screening_questions`
- current + approved + full history of `score_runs` (identity block +
  evidence + requirement_coverage + contradictions)
- `processing_jobs` timeline for the match
- files (CV + versions)
- `candidate_evidence` snapshot
- `audit_events` filtered by `entity_id = match.id` and its child ids
- client preview payload (via `getClientPreview`)
- decisions / notes (`client_decisions`, `score_decisions`)

Query executed against production data: every section rendered non-empty
values for at least one live match (10-candidate seed under
`joaoluciano9812@gmail.com`). Empty states are explicit ("No evidence yet",
"No decisions recorded") — no section silently omitted.

## Client Preview parity

`ClientPreviewCard` (line 889) is a mounted instance of the exact renderer
Clients see, fed with the same DTO shape from `getClientPreview`. When
`client_visibility = hidden` the preview shows the future card so the
reviewer can validate copy, evidence, and score before flipping visibility.
When visible, it shows the live card. There is no divergence between
"preview" and "actual" — same component, same fields, same gate.

## Audit surface

`ActivityAuditTab` (line 926) reads `audit_events` scoped to the match's
entity graph (`candidate_matches`, `score_runs`, `candidate_evidence`,
`files`, `application_answers`, `client_decisions`, `score_decisions`).
Every mutation on those tables has an `AFTER INSERT/UPDATE/DELETE` trigger
writing (actor_user_id, org, before/after, trace_id) via
`tg_write_audit_event`. Verified in `pg_trigger`.

## Result

- 1 review URL, 0 duplicates, 0 competing modals.
- All 14 required sections rendered.
- Single context-aware primary CTA; secondaries dropdown-scoped.
- DTO complete for every section; empty states explicit.
- Client Preview uses the real client renderer, gated by publish invariants.
- Audit tab reads canonical `audit_events`.
- Type-safe (`npx tsgo --noEmit` clean).
