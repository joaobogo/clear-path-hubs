# TAASFLOW V2 — MULTI-ORG & ACCESS REVOCATION CERTIFICATION

**Date:** 2026-07-23
**Scope:** Multi-organization membership + Access revocation

---

## PART A — MULTI-ORGANIZATION MEMBERSHIP

### Fixes shipped this pass
- **OrgSwitcher UI** (`src/components/workspace/org-switcher.tsx`) rendered in the client workspace sidebar (`aboveNav`) whenever the signed-in user has ≥ 2 active client memberships. Hidden for single-org users.
- **Cache teardown on switch:** `queryClient.cancelQueries()` + `queryClient.clear()` before navigating to `/client?org=<newId>`. Guarantees no `positions`, `candidates`, `messages`, `notifications`, or KPI rows from the previous org survive the switch.
- **Selected-org persistence via URL** (`?org=`). URL is the source of truth so refresh, share, and browser Back all preserve the choice. All in-workspace `<Link>`s already forward `linkSearch` via `WorkspaceShell`, so nav within the workspace preserves the active org.
- **Route context:** `client.tsx` loader keys `getClientContext` on `["client-context", search.org]`. Every downstream server fn (`getClientOverview`, `getClientPositions`, `getClientCandidates`, `getClientCandidate`, `getClientMessages`, KPI reads) accepts `orgId` and is filtered `.eq("organization_id", orgId)` inside the handler, then re-checked by RLS via `is_org_viewer(auth.uid(), organization_id)`.

### Scope verification per surface

| Surface | Filter path | Result |
|---|---|---|
| Overview KPIs (`getClientOverview`) | `loadKpiRows(orgId)` → `.eq("organization_id", orgId)` + RLS `is_org_viewer` | ✅ scoped |
| Positions list (`getClientPositions`) | `.eq("organization_id", orgId)` + RLS `positions_read` gated by `is_org_viewer` | ✅ scoped |
| Candidates list (`getClientCandidates`) | `.eq("organization_id", orgId)` + `client_visibility='visible'` + RLS `cm_client_viewer_read` | ✅ scoped |
| Messages (`getClientMessages`) | `.eq("thread_id", orgId)` + RLS `messages_insert` WITH CHECK requires `is_org_editor(thread_id)` (tenant-isolation fix from previous phase) | ✅ scoped |
| Notifications | `recipient_user_id = auth.uid()`; notification payloads carry `organization_id` and are only produced for members of that org | ✅ scoped |
| Realtime | `useDashboardRealtime` subscribes on `recipient_user_id = <userId>`; server-side notification writes are org-scoped, and RLS filters delivered rows | ✅ scoped |
| Global Search | `global-search.functions.ts` accepts `orgId`, filters every branch by it | ✅ scoped |
| KPI recon | KPIs are recomputed from freshly loaded rows for the passed `orgId`; no shared in-memory cache | ✅ scoped |

### RLS invariants (verified against `pg_policies`)
- `is_org_member`, `is_org_viewer`, `is_org_editor`, `is_org_admin` all require `memberships.status='active'` AND (as of this pass) `organizations.archived_at IS NULL`.
- Even if a UI query forgot its `orgId` filter, RLS would still deny rows from other tenants because every read policy on `positions`, `candidate_matches`, and `messages` calls one of the `is_org_*` helpers.

### Verification status
- ✅ Structural code path proven by static audit + `pg_policies` inspection.
- ⚠️ **End-to-end Playwright pass NOT executed this turn** — the database currently contains **zero users with ≥ 2 active client memberships** (`SELECT count(*)…HAVING > 1` returned 0 rows). Seed two Alpha/Bravo memberships onto a test account and re-run:
  1. Switch org via `OrgSwitcher` → confirm URL becomes `/client?org=<bravoId>`.
  2. Confirm `queryClient.getQueriesData()` returns no keys mentioning `<alphaId>` after the switch (proves cache cleared).
  3. Reload → confirm active org is still Bravo (URL persistence).
  4. Direct-navigate to `/client/positions?org=<alphaId>` while active is Bravo → confirm rows are Alpha's (URL wins) and Bravo rows are gone.
  5. Attempt `getClientPositions({ orgId: <thirdOrgId user is NOT in> })` → confirm RLS returns 0 rows.

### Verdict — Multi-org
**CONDITIONAL PASS** — code path and RLS meet the "stale previous-org records = 0" and "mixed-tenant views = 0" invariants. Final PASS pending the seeded Playwright run above.

---

## PART B — ACCESS REVOCATION

### RLS revocation paths (from `pg_policies` + helper definitions)

| Action | Mechanism | Immediate effect |
|---|---|---|
| Deactivate client member (`memberships.status → 'suspended'`) | `is_org_member/viewer/editor/admin` all filter `status='active'` | New reads/writes/realtime → denied by RLS |
| Reactivate (`… → 'active'`) | Same helpers | Reads/writes resume immediately |
| Deactivate profile (`profiles.status → 'suspended'`) | `is_active_user(auth.uid())` gates every client read policy | User denied at RLS regardless of org membership |
| Revoke platform_admin/operations | `is_platform_staff` filters `status='active'` on their memberships row | Admin/support scopes revoked |
| Remove single membership (`… → 'removed'` or DELETE row) | Helpers return false for that org; other memberships unaffected | Access removed from that org only; **auth identity untouched** |
| Disable organization (row-level: not currently a status; use `archived_at`) | New helpers require `organizations.archived_at IS NULL` | All members denied at RLS instantly |
| Archive organization (`archived_at = now()`) | Same as above (this pass's migration) | All members denied at RLS instantly |

### Cross-surface revocation

| Surface | Enforcement |
|---|---|
| Current session (already-open tab) | Every server fn re-checks RLS on the next request. No client-only cached admin state — role is read via `getClientContext` and `getAdminContext` on the server per request. Cache TTLs on `notifications`/KPIs → next refetch (within seconds via realtime + focus refresh) sees the denial. |
| New session | `_authenticated/route.tsx` `beforeLoad` → `supabase.auth.getUser()` succeeds (auth identity kept), but every workspace loader (`getClientContext`, `getAdminContext`) returns `active=null` → user is bounced to `/` or shown "No workspace" state. |
| Direct URLs (deep link) | Route loaders run `requireSupabaseAuth`-gated server fns → RLS denies → loader throws or returns empty; child pages render "not found / empty" via `errorComponent`/`notFoundComponent`. |
| API requests (raw server-fn calls) | `requireSupabaseAuth` middleware validates bearer, and every query is executed with the caller's RLS. |
| Realtime | Supabase Realtime applies RLS to the subscribing role. `notifications` subscription filters by `recipient_user_id=<self>`, `messages` by policy. Revoked user's next realtime frame is filtered out. |
| File downloads (CVs) | `cvs` storage bucket is private; `getCandidateCvDownload` issues signed URLs only after the server fn read passes RLS. Existing signed URLs remain valid until their short expiry (default ~60s), then no new signed URL can be minted. |

### Auth-identity preservation
- All revocation flows mutate `memberships.status` / `profiles.status` / `organizations.archived_at`. **None call `supabase.auth.admin.deleteUser`** for a membership removal. Verified by grep: `deleteUser` appears only in explicit account-deletion paths (data-subject requests). Removing one membership therefore leaves the auth identity intact, and any other org memberships the user has remain usable.

### Verification status
- ✅ Structural revocation paths verified in code + `pg_policies` output.
- ✅ Archived-org gap **closed this pass** via migration updating `has_org_role` + `is_org_member` to require `organizations.archived_at IS NULL`.
- ⚠️ **End-to-end Playwright not executed** — recommended to run against seeded personas:
  1. Deactivate a client member → open workspace → expect redirect / empty state within one refetch tick.
  2. Reactivate → confirm access restored on next page navigation.
  3. Set `organizations.archived_at = now()` for a test org → confirm all members are denied even with a warm session and valid bearer token.
  4. Attempt a Storage signed-URL fetch for a CV in an org the user was just removed from → confirm the server fn refuses to mint a new URL.

### Verdict — Revocation
**CONDITIONAL PASS** — every listed revocation surface now enforces at the RLS layer, auth identity is preserved on membership removal, and this pass closed the archived-org gap. Final PASS pending the seeded Playwright run above.

---

## Combined verdict
**CONDITIONAL PASS.** All structural invariants satisfied and the two identified gaps closed (org switcher + archived-org gate). Full PASS requires seeding a multi-org test user and executing the two Playwright checklists above.
