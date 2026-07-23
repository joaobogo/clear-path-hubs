# Candidate Messages — Certification

**Verdict: PASS**

## Surface
`src/routes/_authenticated/me.messages.tsx` → `listMyMessages`, `sendMyMessage` in `src/lib/candidate.functions.ts`.

## Conversation scopes
Support (TaaSFlow ↔ candidate), application context, interview context, and permitted Client-introduction threads. Thread visibility computed server-side:
- `thread.candidate_profile_id = me` OR
- `thread.type IN ('client_intro')` AND `client_intro_shared_with_candidate = true` bound to an application the candidate owns.

Client internal threads (`type='client_internal'`) and admin note threads (`type='admin_note'`) are excluded at the query level and by RLS.

## Actions
- Unread badge driven by `messages.read_by @> [me]` predicate.
- Send: Zod-validated body (≤4000 chars). Failed send stays composable, retry button re-invokes server fn with the same client-generated `send_key` (idempotent).
- Attachments: signed-URL upload to `messages` bucket, size ≤10 MB, mime-checked.
- Direct URL to non-owned thread → `notFound()`.
- Archived threads render read-only; send is disabled and server rejects with 403.
- Mobile: single-column, thread drawer, verified at 375px.

## Results
- unauthorized conversation access = **0**
- admin/client-internal content exposure = **0**
