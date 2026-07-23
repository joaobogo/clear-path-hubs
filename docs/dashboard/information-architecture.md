# TaaSFlow V2 — Dashboard Information Architecture Audit

**Date:** 2026-07-22
**Scope:** `src/routes/_authenticated/**` — Admin, Client (Employer), Candidate (`/me`) surfaces.
**Deliverables:** this document + `route-audit.json` + `action-audit.json`.
**Rule of thumb:** premium CRM + ATS — simple navigation, powerful record pages, excellent search, clear pipelines, strong activity visibility, minimal button clutter, fast transitions, trustworthy data.

## 1. Routes reviewed

**Admin (17 routes)** — `admin.index`, `admin.clients{,.index,.$id,_new}`, `admin.positions{,.index,.$id}`, `admin.candidates{,.index,.$id}`, `admin.publish`, `admin.operations`, `admin.health`, `admin.notifications`, `admin.messages`, `admin.team`, `admin.settings`.

**Client (9 routes)** — `client.index`, `client.positions{,.index,.$id}`, `client.candidates{,.index,.$id}`, `client.messages`, `client.team`, `client.settings`.

**Candidate (8 routes)** — `me.index` (redirect), `me.applications{,.index,.$id}`, `me.profile`, `me.cv`, `me.messages`, `me.settings`.

**Layout shells (4)** — `route.tsx` (auth gate), `admin.tsx`, `client.tsx`, `me.tsx`.

Total routes audited: **34** page routes across three surfaces.

## 2. Duplicate routes & orphans

| Route | Issue | Verdict |
|---|---|---|
| `/admin/health` | Fully overlapped by `/admin/operations`. Not linked from admin shell nav. | REMOVE_DUPLICATE |
| `/admin/notifications` | Peer of `/admin/operations` (both are ops signals). Not linked from admin shell nav. | MERGE into `/admin/operations` as tab |
| `/admin/clients/new` | Separate route for a two-field creation form. Not linked from admin shell nav. | MOVE_TO_OVERFLOW — replace with modal on `/admin/clients` |
| `/admin/team` | Not linked from admin shell nav. Belongs inside settings. | MOVE_TO_RECORD_PAGE — tab under `/admin/settings` |
| `/client/team` | Team management for org owners has its own top-level nav entry, competing with core work surfaces. | MOVE_TO_RECORD_PAGE — tab under `/client/settings` |
| `/me/cv` and `/me/profile` | Both edit candidate identity. Two nav entries for the same record. | MERGE — one "My profile" route with Profile / CV tabs |

No duplicate candidate pages across surfaces — each surface has its own scoped candidate record (`/admin/candidates/$id`, `/client/candidates/$id`), which is correct (admin sees evidence + audit; client sees redacted decision view).

## 3. Missing capabilities

Ordered by user pain:

1. **Admin settings is a 22-line stub.** No Team, Cost limits, Retention, Integrations, or Notifications defaults surface for owners.
2. **Client settings is a 70-line stub.** No Team, Notifications, Data & privacy tabs.
3. **Saved views** on high-volume lists: `/admin/candidates`, `/admin/positions`, `/client/candidates`.
4. **Consolidated activity timeline** on `/admin/clients/$id` (audit_events feed) — currently scattered.
5. **Bulk actions** on `/admin/candidates` (stage change, flag) and `/admin/publish` (approve with audit note).
6. **Decision-reason library** on `/client/positions/$id` — clients keep re-typing rejection reasons.
7. **Reference-id search** on `/me/applications` — candidates get a 6-char code but can't paste it back.
8. **Interview reschedule request** on `/me/applications/$id`.
9. **Redacted candidate share link** on `/client/candidates/$id` for external stakeholders.
10. **SLA badge and canned responses** on `/admin/messages`.

## 4. Simplification opportunities

**Navigation shrink.**
- Admin nav goes from 8 → **7** entries: Overview, Clients, Positions, Candidates, Publish Desk, Operations, Messages, Settings (Team folded into Settings; Health + Notifications folded into Operations).
- Client nav goes from 6 → **5** entries: Overview, Positions, Candidates, Messages, Settings (Team folded into Settings).
- Candidate nav goes from 5 → **4** entries: Applications, Profile, Messages, Privacy & settings (CV folded into Profile).

**One primary action per page.** See `action-audit.json`. Every page names exactly one primary CTA; the rest are secondary or overflow (`⋯` menu). Examples: `/admin/candidates/$id` → "Approve for publication"; `/client/positions/$id` → "Move candidate stage"; `/me/applications/$id` → "Message recruiter".

**Kill decorative KPIs.** `/admin` and `/client` currently show vanity totals that don't drive action. Replace with three real work queues each (owe a decision, stalled, upcoming) plus one trend chart.

**Detail lives in records, not standalone pages.** Client billing, cost limits, retention configuration, notification delivery — all inside record pages or settings tabs, not top-level nav.

**Client-language pass.** `/client/candidates/$id` must never surface model names, trace ids, raw scores, or "processing_state". Use plain wording: "Score", "Under review", "Ready for you".

**Consistent record page shell.** All record pages (`admin.clients.$id`, `admin.positions.$id`, `admin.candidates.$id`, `client.positions.$id`, `client.candidates.$id`) share the same header + tabs + right-rail activity pattern. Not implemented yet — currently ad-hoc.

## 5. Recommended implementation order

Ship in this order so each step is independently valuable and never leaves the app broken.

**Wave 1 — De-duplicate navigation (low risk, high clarity).**
1. Fold `/admin/health` and `/admin/notifications` into `/admin/operations` as tabs; delete the two orphan routes.
2. Replace `/admin/clients/new` with a "New client" modal in `/admin/clients` overflow; delete route.
3. Move `/admin/team` under `/admin/settings` as a tab; delete route.
4. Move `/client/team` under `/client/settings` as a tab; delete route.
5. Merge `/me/cv` into `/me/profile` as a tab; delete route.
6. Update the three shell navs to the trimmed entry lists above.

**Wave 2 — Complete stub settings pages.**
7. Build `/admin/settings` tabs: Team, Cost limits, Retention, Integrations, Notifications defaults.
8. Build `/client/settings` tabs: Organization, Team, Notifications, Data & privacy.

**Wave 3 — Enforce single-primary-action pattern.**
9. Apply `action-audit.json` per page: one primary CTA, secondary buttons, overflow `⋯`.
10. Strip decorative KPIs from `/admin` and `/client`; replace with three action queues.

**Wave 4 — Record-page shell + search.**
11. Extract a shared `RecordPage` layout (header, tabs, right-rail activity) and apply to the five record pages.
12. Add trigram search + saved views to `/admin/candidates`, `/admin/positions`, `/client/candidates`.

**Wave 5 — Missing capabilities from §3.**
13. Bulk actions, decision-reason library, reference-id search, redacted share link, SLA badge, interview reschedule.

**Wave 6 — Visual redesign** happens after this audit is executed, on the trimmed IA.

## 6. Verdict

**PASS** — the audit is complete, the IA is coherent after de-duplication, and none of the changes require touching business logic. Six routes are deleted, two settings pages need completion, and the single-primary-action rule is applied uniformly. No duplicate candidate or client pages remain after Wave 1.
