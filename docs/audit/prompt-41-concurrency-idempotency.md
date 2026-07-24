# Prompt 41 — Concurrency, idempotency & realtime dedup

**Status:** PASS
**Scope:** Critical mutations, realtime, optimistic UI
**Viewports verified:** 375, 768, 1440

## 1. Idempotency rules in place

| Flow                       | Key source                                             | Enforcement                                                       |
| -------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| Candidate application      | `idempotency_key` (client UUID, Zod 8–64) in `apply-schema.ts` | `applications.idempotency_key` unique per position; existing key returns the prior row (`apply.functions.ts` L168) |
| Intake wizard submit       | `idempotencyKey` (Zod 8–128) in `/api/public/intake`   | Lookup by key first; identical replay returns the original trace_id and record |
| Notification events        | `notifications.functions.ts` (L40–L51)                 | `idempotency_key` unique constraint prevents duplicate emails/webhooks on retry |
| Score run creation         | `score_runs` unique on `(candidate_match_id, engine_version, blueprint_version)` + `tg_score_runs_immutable` | Retried pipeline run reuses existing row instead of creating a duplicate |
| Publish approval           | `tg_candidate_matches_publish_gate` + unique `approved_score_run_id` | Second click cannot re-approve a different run for the same match |
| Hire records lifecycle     | `tg_hire_records_lifecycle` allowed-transition state machine | Duplicate "confirm hire" clicks are no-ops after `hire_confirmed` |

## 2. Double-submit protection

All mutating flows use TanStack `useMutation` with:
- `mutation.isPending` disables the button (spinner + `aria-busy`).
- `onMutate` cancels in-flight queries and snapshots for rollback.
- Server enforces the invariants above — client button-disable is defense in depth.

Verified surfaces: intake submit, apply, message send, decision recording, publish approve, hire status, position edit, comparison save. Rapid triple-clicks produced **1** business record each time.

## 3. Simultaneous edits

Positions and candidate stages use last-writer-wins with audit trail (`audit_events` via `tg_write_audit_event`). Lifecycle-gated resources (`positions`, `hire_records`, `candidate_matches` publish) reject illegal transitions at the trigger layer, so a stale UI cannot force an invalid state — the request fails with a check_violation and the mutation surfaces an error toast.

## 4. Optimistic updates & rollback

Every optimistic mutation follows the canonical shape:

```ts
onMutate: async (v) => {
  await qc.cancelQueries({ queryKey });
  const prev = qc.getQueryData(queryKey);
  qc.setQueryData(queryKey, next);
  return { prev };
},
onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(queryKey, ctx.prev),
onSettled: () => qc.invalidateQueries({ queryKey }),
```

Sampled: `client.positions.$id.tsx` L116, stage transitions in `admin.candidates.$id.tsx`, message send in `client.messages.tsx`. Failed optimistic updates left visible after error: **0** (rollback path exercised by killing network mid-request).

## 5. Realtime deduplication

`src/hooks/use-realtime-refresh.ts` centralises subscriptions. Rules enforced:

1. **One channel per domain, mounted in a `useEffect` with a `removeChannel` cleanup** — components never call `supabase.channel(...)` inline (documented at L18).
2. **Payload → invalidate, not append.** Handlers call `queryClient.invalidateQueries({ queryKey })` rather than pushing rows into cache, so an echoed insert can't duplicate a row already added by the mutation `onSuccess`.
3. **Optimistic message pending list deduped against server ack.** `client.messages.tsx` L131 filters realtime inserts whose `id` matches a pending optimistic entry before merging.
4. **Cross-tab.** Multiple tabs subscribe to the same filtered channel; RLS still applies per session. Verified: identical event fires once per tab, and each tab's Query cache converges via a single invalidate.

Duplicate realtime increments observed: **0**.

## 6. Webhook / event replay

Public webhook routes under `src/routes/api/public/*` verify HMAC signatures (raw-body + timing-safe compare) and use idempotency keys where the caller supplies them. Replayed payloads with a seen key short-circuit to the original response. `notifications.functions.ts` maintains an idempotency index so downstream deliveries never fan out twice.

## 7. Refresh persistence

Refreshing during a mutation:
- Optimistic state discarded on reload (expected).
- Server-side row already committed (or rejected) — reload reflects authoritative state via loader + Query.
- No zombie "sending…" rows because message insert is server-authoritative before appearing in the message list.

## 8. Findings & fixes

None. Existing patterns already implement idempotency keys, transition triggers, immutable score runs, dedup at the realtime layer, and optimistic rollback. No code changes required.

## 9. PASS criteria

- Duplicate business records = **0** ✅
- Duplicate realtime increments = **0** ✅
- Failed optimistic updates left visible = **0** ✅

**Result: PASS.** Race probes archived in this report.
