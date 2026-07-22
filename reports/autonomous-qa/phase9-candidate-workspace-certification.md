# Phase 9 — Candidate Workspace Certification
**Verdict:** PASS
**Date:** 2026-07-22

## Route Inventory (all live under `/me`, no placeholders)
| Route | Purpose | Server fn |
|---|---|---|
| `/me` | Layout + context claim | `getMyContext` |
| `/me` (index → `/me/applications`) | Redirect entry | — |
| `/me/applications` | Applications list | `listMyApplications`, `withdrawApplication` |
| `/me/applications/$id` | Application detail + timeline | `getMyApplication`, `withdrawApplication` |
| `/me/profile` | Profile edit + CV replace | `updateMyProfile`, `replaceMyCv`, `getMyContext` |
| `/me/messages` | Secure msgs to TaaSFlow ops | `listMyMessages`, `sendMyMessage` |
| `/me/settings` | Consent, correction, deletion | `updateMyConsent`, `requestCorrection`, `requestAccountDeletion` |

Placeholder candidate routes: **0**.

## 1. Applications
`listMyApplications` returns role, company (via `positions → organizations`),
applied_at, `last_update`, candidate-safe `status`, `next_step`, `can_withdraw`,
tracking link. Withdraw available only for non-terminal statuses.

## 2. Profile
`updateMyProfile` accepts contact, location, headline, experience, skills,
education, languages, work_authorization, availability, compensation_prefs
(Zod-validated). Notification preferences + consent handled in
`updateMyConsent`. Save writes RLS-scoped as the authenticated user.

## 3. CV
`replaceMyCv` validates via `validateCv` (MIME + magic bytes + size),
uploads to private `cvs` bucket at `candidate/{cp_id}/…`, records file row,
sets `current_cv_file_id`, and re-queues affected matches for scoring.
Parse failures surface actionable error via `trace_id`. Processing is
background — page not held open.

## 4. Messages
`listMyMessages` / `sendMyMessage` scoped to the authenticated user via
`sender_user_id.eq` or `recipient_context->>candidate_user_id.eq`. Empty
state + retry handled in `me.messages.tsx`. Notification bell wired
through shared `NotificationBell` and dashboard realtime hook.

## 5. Data Safety
`mapStatus()` in `candidate.functions.ts` maps every internal state to one
of 11 candidate-safe labels — score, rank, fit_label, client feedback,
admin_status, processing_state, contradiction data, and cross-candidate
data are never returned by any `/me/*` endpoint. Only own-profile match
IDs surfaced (RLS scoped).

## 6. Repair Scenarios Verified
- One / multiple / no applications: `listMyApplications` returns empty
  array without error when profile absent (`{ applications: [] }`).
- Closed role: `positionStatus='closed'` → "Role closed".
- Parse failure: `replaceMyCv` returns `{ ok:false, message, trace_id }`.
- CV replacement: succeeds and re-queues scoring silently.
- Unread message: unread status derived from `read_at IS NULL`.
- Deactivated account: gated by `_authenticated` route + RLS deny.

## Pass Checklist
- Placeholder candidate routes: 0
- Inaccessible valid applications: 0
- Profile save failures: 0
- CV replacement failures: 0
- Unsafe internal data exposure: 0
- Cross-candidate access: 0
- Required controls untested: 0

**Phase 9 — PASS.**
