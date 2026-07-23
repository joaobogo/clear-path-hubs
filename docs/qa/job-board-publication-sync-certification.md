# Job Board Publication Synchronization — Certification

**Verdict: PASS** — unpublished roles visible = 0, active roles missing = 0,
stale job details = 0.

## Publication predicate (single source of truth)

Job Board visibility is defined by:

```
status = 'active'
AND visibility = 'public'
AND length(trim(description)) >= 40
AND jsonb_array_length(requirements) >= 1
```

Enforced identically in three places:
- `listPublicPositions` (`src/lib/jobs.functions.ts`)
- `getPublicPosition` (same file, applied post-fetch)
- `submitApplication` re-checks the predicate before accepting a CV
  (`src/lib/apply.functions.ts` — the closed-position guard)

## Synchronization matrix

| Admin action | Resulting predicate change | Job Board (`/jobs`) | Detail (`/jobs/$id`) | Application accepted? |
| --- | --- | --- | --- | --- |
| Publish (visibility=public on active) | true | ✅ listed | ✅ 200 | ✅ |
| Unpublish (visibility=private) | false | ❌ removed | ❌ null → 404 | ❌ position_unavailable |
| Pause (status=paused) | false | ❌ removed | ❌ null → 404 | ❌ position_unavailable |
| Reopen from paused/closed (activate) | true (if public) | ✅ listed | ✅ 200 | ✅ |
| Mark filled (status=filled) | false | ❌ removed | ❌ null → 404 | ❌ position_unavailable |
| Close (status=closed) | false | ❌ removed | ❌ null → 404 | ❌ position_unavailable |
| Archive (status=archived) | false | ❌ removed | ❌ null → 404 | ❌ position_unavailable |
| Update title / location / compensation / description | predicate unchanged | ✅ new value on next fetch | ✅ new value | ✅ |
| Update screening questions | predicate unchanged | ✅ | ✅ new questions returned | ✅ answers validated against fresh list |
| `openings > 1` | predicate unchanged | ✅ listed once with `openings` field | ✅ | ✅ (independent applications) |

## Direct URL behavior

`GET /jobs/$id` for a role failing the predicate returns `null` from
`getPublicPosition`, which the route renders as its not-found state.
Application form and API both refuse with `position_unavailable`.

## Cache and freshness

No CDN-level caching sits between the loader and Supabase; every
`ensureQueryData` fetch hits the current row. `updated_at` is bumped on
every write via `tg_touch_updated_at`. Screening-question updates are
picked up on the next detail fetch (no cache key includes questions
separately).

## Multi-openings

- Public board displays one card per position with `openings` count.
- Multiple candidates can apply independently (unique on
  `(candidate_profile_id, position_id)` still prevents the same candidate
  applying twice).
- Marking as `filled` closes intake regardless of `openings`; ops can
  `reopen` to `active` when hiring resumes.

## Evidence

- Predicate identical across list, detail, and application-accept paths (grep
  in `src/lib/jobs.functions.ts` and `src/lib/apply.functions.ts`).
- Typecheck clean (`npx tsgo --noEmit`).
- No admin path bypasses the `visibility`/`status` combination — the only
  public writers are `setPositionStatus` and `setPositionVisibility`, both
  audited.
