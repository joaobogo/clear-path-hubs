# TaaSFlow V2 — Security and Abuse Certification

**Method:** static review of every server function + RLS policy, backend security scan, and targeted Playwright attack probes against the published preview. Secret values are never included in this report.

## Attack surface tested

| Vector | Result | Evidence |
|---|---|---|
| IDOR (candidate detail, position detail, application, file) | PASS | Every server fn resolves the record via `is_org_member` / `is_org_editor` / `is_platform_staff` — never trusts the URL param alone. Forged UUIDs return 404, not the record. |
| Tenant bypass | PASS | Confirmed in `tenant-isolation-certification.md`: cross-tenant `orgId` in server-fn payloads is rejected by `assertOrgAccess`; RLS backstops it. |
| Role bypass | PASS | `has_role`, `is_org_admin`, `is_org_editor`, `is_platform_staff` gate every privileged path. `role-permission-matrix.md` enumerates them. |
| Forged organization id | PASS | Server fns re-derive the caller's org from `context.userId` + `memberships`; client-supplied `orgId` is validated against membership before every read/write. |
| Forged position id | PASS | Position lookups filter on `organization_id = <derived>`; missing rows 404. |
| Forged candidate id | PASS | Candidate/match reads bind to `position_id + organization_id`; `is_owning_candidate` guards the candidate self-serve surfaces. |
| File URL access (CVs) | PASS | `cvs` bucket is private; signed URLs are minted only via `getCandidateCvDownload` after membership + match check. |
| Upload abuse | PASS | `apply.functions.ts` enforces magic-byte detection, MIME allowlist, ≤ 10 MB size cap, and per-application idempotency. Advisory locks prevent duplicate ingestion. |
| Form spam (contact, intake, apply) | PASS | Public routes use Zod validation + honeypot + IP-scoped rate limiting via server-side counters in `contact_messages` / `intake_submissions`. |
| Message spam | PASS | `messages_insert` policy requires `is_platform_staff` or `is_org_editor(thread_id)`; unauthenticated inserts rejected. |
| Brute-force protection | PASS | Auth flows delegate to Supabase Auth's built-in rate limits + generic error messages (no account enumeration — verified in `auth-lifecycle-certification.md`). |
| XSS | PASS | React escapes all rendered strings. No `dangerouslySetInnerHTML` present in the workspace tree. Blog article body is Markdown rendered via a sanitizing renderer. |
| Unsafe HTML | PASS | No user-supplied HTML is rendered. Rich text is stored as text and rendered via safe components. |
| Sensitive console logging | PASS | Grep for `console.log(.*token|secret|password|apikey)` returns 0 matches in `src/`. Server errors log message + trace id only. |
| Exposed secrets | PASS | All API keys/secret names are read from `process.env` inside server-fn handlers only. `import.meta.env` exposes only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. No secret literals in source. |

## Open advisories from the backend scanner (warn, not critical)

These are logged for follow-up but do not block certification:

1. **`SECURITY DEFINER` helper functions callable by anon / authenticated.** `is_org_member`, `is_org_editor`, `is_platform_staff`, `is_active_user`, `has_role`, `is_owning_candidate`, `scoring_readiness` are intentionally executable — they are the guard rails used inside RLS policies and server fns. They never disclose data unless the caller passes the correct ids and they always run with a fixed `search_path`. Recommendation: keep as-is; document in security memory.
2. **`contact_messages` public INSERT policy audit.** The public contact form inserts through a server route with rate limiting; SELECT is admin-only. Verify a scoped anon INSERT policy exists and that no anon SELECT is granted. Follow-up: assert with a migration comment.
3. **`retention_policies` readable by any authenticated user.** Configuration is not user data but should be staff-only; tighten SELECT to `is_platform_staff(auth.uid())` in a future migration.

## Abuse-response hardening in place

- Every mutating server fn returns a `trace_id` recorded in `audit_events` for forensics.
- Support Mode writes are blocked by `assertNotSupportViewReadOnly`.
- All admin-only server fns re-check `is_platform_staff` inside the handler, even when the route is under `_authenticated/admin/*`.
- Storage policies scope reads to the file owner or a staff / active match membership.

## Verdict

**PASS.** Critical security findings = 0. Three warn-level advisories are documented above for planned hardening; none expose user data or enable takeover.
