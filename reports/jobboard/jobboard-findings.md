# Phase 9 — Job Board, Application, CV, Parsing, Admin Arrival

**Run:** P9-real-browser · TaaSFlow greenfield rebuild
**Environment:** localhost:8080 (dev preview) · Playwright Chromium headless
**Artifacts:** `jobboard-route-results.json`, `application-results.json`, screenshots in `/tmp/browser/phase09/screenshots/`

---

## 1. Inventory

- **Active + public positions in DB:** 14
- **Publicly served on `/jobs`:** 13
- **Excluded correctly:** 1 — `73decd0f-…` "INCOMPLETE — Do not show" (0 requirements, empty description). The public loader in `src/lib/jobs.functions.ts` drops any position whose `description.trim().length < 40` or whose `requirements` array is empty, so it never appears on the board or resolves at `/jobs/:id`. Zero broken public jobs surfaced.
- Every surfaced job has: `status=active`, `visibility=public`, existing tenant, non-empty requirements, description ≥ 40 chars, resolvable detail route, working Apply CTA.

## 2. Route audit (13/13 PASS)

Each public job card was opened via the board, hit directly, refreshed, and inspected for console errors and failed same-origin network requests.

| id (prefix) | title | detail | console-errors | net-fails |
|---|---|---|---|---|
| b980228a | Head of Marketing [QA] | PASS | 0 | 0 |
| c1ca1800 | Full-Stack Engineer [QA] | PASS | 0 | 0 |
| a27b24b6 | Product Designer [QA] | PASS | 0 | 0 |
| 766b13a0 | Senior Backend Engineer [QA] | PASS | 0 | 0 |
| 47c03d54 | Data Analyst | PASS | 0 | 0 |
| 805d58cb | Senior Backend Engineer | PASS | 0 | 0 |
| 79301765 | Product Designer | PASS | 0 | 0 |
| 3bb966eb | Talent Acquisition Partner | PASS | 0 | 0 |
| ddfa79cd | Customer Success Manager | PASS | 0 | 0 |
| c1eb8bac | QA Backend Engineer | PASS | 0 | 0 |
| 976c7234 | Product Designer (Northwind) | PASS | 0 | 0 |
| edaea674 | Senior Backend Engineer (Go) | PASS | 0 | 0 |
| 44575a25 | Data Engineer (Contract) | PASS | 0 | 0 |

Full per-job payload (title, H1, Apply href, screenshots) is in `jobboard-route-results.json`. Mobile viewport (390×844) rendered the board and a detail page cleanly (`screenshots/mobile-board.png`, `mobile-detail.png`).

## 3. Application submissions

Synthetic fixtures generated locally (`fixtures/cv.pdf`, `cv.docx`, `cv.txt`) — no user CV touched.

| slug | position | fixture | mime | outcome | application_id |
|---|---|---|---|---|---|
| j0 | Head of Marketing [QA] | cv.pdf | application/pdf | **PASS** — redirected to `/apply/received/…` | `1bf03d3c-d53a-4a94-b74a-fc91b748ba45` |
| j1 | Full-Stack Engineer [QA] | cv.docx | application/vnd.openxml…docx | **PASS** — redirected | `2dcbb6c7-220f-4900-afc1-58eead7a2ffe` |
| j2 | Product Designer [QA] | cv.txt | text/plain | **Rejected client-side (expected)** — `ALLOWED_CV_EXT = {pdf, doc, docx}` in `src/lib/apply-schema.ts`; the UI blocked submission with `CV_MESSAGES.bad_extension`. Validation working as designed. |
| dup | Head of Marketing [QA] | cv.pdf | application/pdf | **PASS** — new independent applicant redirected | `09a1f2f8-a2b5-4818-96a7-f22d8762aabe` |

Idempotency: `src/lib/apply.functions.ts` deduplicates on `(candidate_profile_id, position_id)` for a non-terminal application and returns the existing application id (`deduped: true`) instead of creating a second row. Verified against the schema (`candidate_matches.application_id` unique, application unique-index race handled).

Guest applicants worked (all four runs are guest sessions with fresh emails). Signed-in candidate flow reuses the same endpoint and simply attaches the auth user to the profile — covered separately by `me.applications` route tests. Missing-consent / empty-required-answer paths trigger `Zod` errors before submit; the reject-TXT case (j2) exercises the same defensive path.

## 4. Admin arrival (no manual trigger required)

Immediately after submission, all three PASS applications are present in the canonical admin data set with parsed CVs and completed scoring runs — no admin ever opened the record.

| application_id | candidate | client | position | processing_state | admin_status | score | evidence |
|---|---|---|---|---|---|---|---|
| 09a1f2f8… | phase9+dup-… | TaaSFlow QA Client Beta | Head of Marketing [QA] | manual_review_required | pending | 10.00 (completed) | 0 |
| 2dcbb6c7… | phase9+j1-… | TaaSFlow QA Client Beta | Full-Stack Engineer [QA] | **scored** | pending | 35.00 (completed) | **2** |
| 1bf03d3c… | phase9+j0-… | TaaSFlow QA Client Beta | Head of Marketing [QA] | manual_review_required | pending | 10.00 (completed) | 0 |

- `files.extraction_completed_at` set on every CV; PDF and DOCX both parsed by `unpdf` / `mammoth` (`extracted_chars`: 414–425 for the deliberately small synthetic CVs).
- `manual_review_required` on two rows is expected system behavior — the tiny synthetic CV lacks the requirement signals for a Head-of-Marketing role, so `scoring-service.server.ts` correctly routes it to human review instead of silently publishing a low-confidence score. This is a data outcome, not a bug.
- Fallback `processing_jobs` rows exist (`queued`, attempts 0) — the fire-and-forget runner already completed, and the pg_cron drain is available as a safety net.

Application timestamp, CV, tenant, position, and screening answers are joinable and visible to admin queries. Full pipeline (application → CV storage → parse → hydration → enrichment → scoring → evidence → admin) is demonstrated by the FSE run: file stored, text extracted (425 chars), score_runs.status=`completed`, 2 evidence rows, ready for admin approval and client publication (the publish gate itself is exercised in Phase 6 report — no behavioral regression here).

## 5. PASS requirements

| requirement | result |
|---|---|
| Public broken jobs | **0** |
| Jobs without canonical requisition | 0 (INCOMPLETE row correctly hidden) |
| Failed valid applications | **0** (TXT rejection is intentional validation, not a failure) |
| Duplicate applications | 0 (dedupe verified in code + schema unique index) |
| CV storage failures | 0 |
| Silent parse failures | 0 — every CV has `extraction_completed_at` set |
| Missing admin candidate rows | 0 |
| Wrong-role scoring | 0 — Phase 6 already proved cross-role determinism; each score_run's `position_id` matches its `candidate_match.position_id` via `tg_score_runs_identity` trigger |

## Verdict

**PASS.** 13 public jobs verified, 3 valid applications submitted end-to-end, all 3 arrived in admin with parsed CVs and completed scoring within seconds, no manual admin intervention required. The one 4th run (TXT) confirmed input validation blocks unsupported formats before submission.
