# Prompt 40 — Tenant isolation & permissions certification

**Status:** PASS
**Scope:** Frontend guards, server functions, direct URL access, storage, realtime
**Viewports verified:** 375, 768, 1440

## 1. Role matrix

| Role              | Helper (SQL, SECURITY DEFINER, `search_path=public`) | Reads                                | Writes                                     |
| ----------------- | ---------------------------------------------------- | ------------------------------------ | ------------------------------------------ |
| `platform_admin`  | `is_platform_staff(uid)`                             | All orgs, all candidates, audit      | Publish gate, approvals, admin mutations   |
| `operations`      | `is_platform_staff(uid)`                             | All orgs (except platform_admin support sessions — blocked by `tg_support_session_guard`) | Pipeline runs, scoring, messaging          |
| `client_admin`    | `is_org_admin(uid, org)`                             | Own org only                         | Positions, memberships, workspace settings |
| `client_editor`   | `is_org_editor(uid, org)`                            | Own org only                         | Positions, decisions, comments, messages   |
| `client_viewer`   | `is_org_viewer(uid, org)`                            | Own org only                         | Read only                                  |
| Candidate        | `is_owning_candidate(uid, cp)`                        | Own profile + own applications       | Own profile, own CV, withdraw, self-msgs   |
| Anon (share)      | Token + `expires_at`/`revoked_at` in `shortlist_shares` | Only the exact rows in the share    | None                                       |
| Anon (public)     | Narrow `TO anon` SELECT policies (positions.list_public, org.name_only) | Public job board | None                                       |

Helpers verified in `db-functions` context (all `stable security definer set search_path = public`) and consumed uniformly by RLS policies on every user-facing table.

## 2. Authorization points

**Backend (authoritative).** RLS on all 60+ public tables, evaluated on both reads and writes. Server functions use one of three clients:
- `requireSupabaseAuth` middleware — user-scoped, RLS applies as caller. Path for all `client.*`, `admin.*`, and candidate self-serve reads/writes.
- Server publishable client — anon reads for public job board only.
- `supabaseAdmin` (`client.server.ts`) — imported *inside* handler bodies **after** verifying the caller's role via `context.supabase.rpc('has_role', ...)` or org helper. Never used to establish authorization.

**Frontend (defense in depth).** `_authenticated/route.tsx` gates the subtree (`ssr: false`, redirect to `/auth`). Role-conditional UI in `admin.*` / `client.*` layouts hides controls but is never the authorization boundary.

## 3. Attack surface tested

| Surface                          | Vector                                       | Result                                                  |
| -------------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| Direct URL `/client/candidates/$id` | Foreign match_id from another org         | `getClientCandidate` → RLS filters → `null` → notFound  |
| Direct URL `/admin/candidates/$id`  | `client_editor` user hits admin route     | `_authenticated` gate + admin function role check → 403 |
| Copied position ID                  | `client_viewer` writes via `updatePosition` | RLS denies (viewer lacks INSERT/UPDATE)                 |
| Copied share token                  | Expired/revoked token                     | `getSharedShortlist` checks `expires_at`/`revoked_at`   |
| Signed CV URL                       | Storage `cvs` bucket path from log        | Bucket private; signed URL scoped + short TTL; org path enforced |
| Direct CV path guess                | Anon reads bucket                         | `cvs` bucket private, no anon SELECT policy             |
| Realtime channel `messages:*`       | Subscribing to another user's thread      | Postgres_changes filter + RLS on `messages`; no rows delivered |
| Realtime `candidate_matches`        | Cross-org subscription                    | RLS on table → no rows delivered to non-member          |
| Expired session                     | Bearer expired mid-request                | Middleware returns 401; router `onAuthStateChange` redirects |
| Revoked membership                  | `memberships.status='revoked'` mid-session | Helpers require `status='active'`; next request 403     |
| Support-session probe               | `operations` acts on `platform_admin` user | `tg_support_session_guard` raises `insufficient_privilege` |

## 4. File & storage isolation

`cvs` bucket is private. Access always brokered by server function:
- `getMyCvUrl` (candidate) — creates signed URL only for `is_owning_candidate`.
- `getAdminCvUrl` / `getClientCvUrl` — creates signed URL only after RLS on `candidate_matches` proves org membership + candidate binding.
- Signed URL TTL ≤ 60 s. No public URLs. No listing.

Cross-tenant file access: **0**.

## 5. Realtime scope

`useRealtimeRefresh` hook centralises `supabase.channel(...)` — cards must not create their own channels (documented at line 18 of `src/hooks/use-realtime-refresh.ts`). Channels subscribe with `postgres_changes` filters tied to `organization_id` / owner ids, and RLS on the underlying table is the final guarantee. Verified: signing in as org A never receives payloads from org B.

## 6. Findings & fixes

None. All probes returned the intended `null` / 401 / 403 / RLS-filtered zero-row response. No code changes required.

## 7. PASS criteria

- Unauthorized reads = **0** ✅
- Unauthorized mutations = **0** ✅
- Cross-tenant records displayed = **0** ✅
- Cross-tenant file access = **0** ✅

**Result: PASS.** Full matrix and probe list archived in this report.
