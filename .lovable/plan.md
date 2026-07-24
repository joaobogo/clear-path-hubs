# Full-System Audit & Fix Pass

Goal: walk every button, action, and background step across the three personas (Client, Candidate, Admin) plus the shared pipeline, catch every broken/half-wired/error-throwing path, and fix them in one coordinated pass.

## Method

For each surface below I will:
1. Enumerate routes and every interactive element (buttons, forms, dropdown items, dialogs, links).
2. Trace each action to its server fn / mutation / RLS policy.
3. Exercise the flow with Playwright against localhost (signed-in as platform admin using the injected Lovable session; anonymous for public flows) and capture screenshots + console + network.
4. Cross-check dev-server logs and `stack_modern--server-function-logs` after each flow.
5. Fix findings inline (RLS, server fn, UI wiring, empty-state handling, toast/error surfacing).
6. Re-run the same script until the flow is clean.

## Scope

### 1. Public / Candidate surface
- `/` marketing, `/jobs` board — filters, search, pagination, empty state, slug links
- `/jobs/$slug` detail — CTA, sharing, metadata
- `/apply/$slug` — form validation, CV upload (size/type/virus states), screening answers, submit → reference ID page
- `/track/$ref` — status polling, chat, doc downloads
- Realtime notifications hook

### 2. Client dashboard (`/client/*`)
- Overview, Positions (kanban), Position detail, Candidate detail (dossier + ScoreExplainability)
- Comparison tableau, Talent Pool, Silver Medalists, Weekly Business Review, Executive Portfolio
- Offer/Hire tracking transitions (state-machine trigger)
- AI Assistant chat (permissions, tools, citations)
- Shortlist share create/revoke, stakeholder view via token
- Branding settings, notification preferences
- Every dropdown action, bulk action, filter, export button

### 3. Admin dashboard (`/admin/*`)
- Intake queue, Position publish desk (publish gate trigger)
- Candidate list + detail: approve/reject score run, request re-parse, re-score, delete (verify recent fix), assign talent pool, add to silver medalists
- Evidence review + verification
- Users/Members, Role management (has_role, is_platform_admin, is_platform_staff)
- Admin AI Copilot (verify Outreach/Sources removal was clean)
- Metrics, WBR admin view
- Support session start (tg_support_session_guard)

### 4. Intake wizard (5 steps)
- Draft save/resume idempotency, Zod validation on each step, submit → position creation, org/user/membership provisioning

### 5. Pipeline (background)
- CV upload → files row → parse (extracted_text) → candidate_evidence extraction (Gemini) → score_run (immutable trigger, identity trigger) → publish gate
- `scoring_readiness` blockers surfaced in admin UI
- Processing state transitions and `processing_jobs` retry
- Failure modes: unparseable CV, missing requirements, tenant mismatch, disqualifying answer

### 6. Cross-cutting
- RLS: `is_org_member`, `is_platform_admin`, `has_org_role` on every table exercised
- Storage: `cvs` bucket signed-URL access for candidate + admin
- Realtime channels
- 404 / errorComponent on every route with a loader
- Mobile responsiveness spot-check on the dashboards (recent 320px pass covered marketing only)

## Deliverables

- Findings table: surface → action → observed error → fix → verification screenshot/log
- Fixes committed: RLS migrations, server fn hardening, UI empty-state/error toasts, dead-button removal
- A short "known limitations" note for anything intentionally out of scope

## Ground rules

- No feature additions. Only fixes to broken/misleading/erroring behavior.
- No visual redesign — keep current tokens and layouts.
- Every fix verified by re-running the exact repro before moving on.
- If a finding requires a product decision (e.g. "what should this button actually do?"), I stop and ask rather than guess.

## Clarifications before I start

1. **Test data**: OK to seed a demo org + position + candidate with QA_SEED_TOKEN so I can exercise the full pipeline end-to-end, or should I only audit against existing data?
2. **Scope of "fix"**: if I find a button that's wired but the underlying feature was never finished (e.g. an export that returns TODO), do you want it removed, disabled with a tooltip, or implemented?
3. **Priority order**: audit in the order above (Candidate → Client → Admin → Pipeline), or lead with Admin since you use it most?

I'll proceed with defaults (yes seed, disable half-built buttons, Candidate → Client → Admin → Pipeline) if you don't answer — just flag any you want changed.