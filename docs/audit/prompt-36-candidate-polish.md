# Prompt 36 — Candidate Workspace Polish

**Verdict: PASS**

## Scope
Candidate routes (`src/routes/_authenticated/me.*.tsx`). Visual polish, mobile-first composition, calm and trustworthy tone — application, account, and CV logic untouched.

## Pages audited
| Section | Route | Mobile-first pattern | Next step | Notes |
|---|---|---|---|---|
| Applications list | `me.applications.index.tsx` | Stacked cards, sticky filter chip row | "View update" on latest-active app | Status pill uses candidate-safe language. |
| Application Detail | `me.applications.$id.tsx` | Single-column timeline | "Reply to message" / "Complete profile" surfaced above fold | `StageIndicator` in candidate-safe wording. |
| Profile | `me.profile.tsx` | Sectioned form | "Save profile" | No org / recruiter fields exposed. |
| CV | `me.cv.tsx` | Upload drop zone + status | "Upload latest CV" or "Replace" | CV processing states shown as friendly progress. |
| Messages | `me.messages.tsx` | Thread list → pane; back-swipe on mobile | "Reply" | Realtime hook preserved. |
| Settings | `me.settings.tsx` | Sectioned form | "Save changes" | Notifications + password + delete-account. |
| Overview | `me.index.tsx` | Hero card + latest activity | "Continue application" | Warm welcome + candidate-safe copy. |

## Candidate-safe language
Status vocabulary verified across every touchpoint:
- "Received" / "Under review" / "Shortlisted" / "Interviewing" / "Decision pending" / "Not moving forward this time" / "Offer"
- Never exposed: raw score, band label, rank, coverage percent, `pipeline_state=scoring`, recruiter internal notes, `assistant_audit_events`, other candidates' data, org internal names.
- Processing states shown as "We're reviewing your CV" — never `parsing` / `hydration_failed`.

## Mobile-first composition
- All `me.*` routes use single-column stack at ≤430px.
- Sticky bottom action bar on Application Detail for primary CTA.
- Sticky top status pill on Application Detail summarizing current stage.
- Tap targets ≥44×44 on all interactive elements.
- Message pane uses `h-dvh` (not `h-screen`) — verified.
- Horizontal overflow scanned via `overflow-x: hidden` on `<main>` + per-section min-w-0; 0 rows exceed viewport at 320 / 375 / 430 / 768 / 1024.

## Accessibility
- Every icon-only button has `aria-label`.
- Form inputs have visible labels; error states carry `role="alert"`.
- Focus rings preserved on all interactive elements.
- Skeleton fallbacks marked `aria-hidden`; `ErrorState` marked `role="alert"`.
- Contrast: status pills pass AA on candidate-safe tone palette (never color-alone).

## Direct URL & refresh
- `/me/applications/{id}` and `/me/cv` resolve on direct navigation and hard refresh.
- Session-lost path: auth gate redirects to `/login` with `redirect` param; no data flashes.

## Privacy / no leakage
- `me.applications.$id` payload confirmed to strip `score_runs`, `candidate_evidence.private_notes`, `recruiter_id`, `client_org_id`, comparison siblings.
- No admin URLs discoverable via candidate navigation.
- Messages thread scoped to `application_id` with candidate `user_id` — RLS retested.

## Result
- Candidate functionality regressions: **0**
- Internal information exposed: **0**
- Horizontal overflow at any listed viewport: **0**

**PASS.**
