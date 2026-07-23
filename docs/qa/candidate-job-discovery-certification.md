# Candidate Job Discovery — Certification

**Scope:** `/jobs` (list) and `/jobs/$id` (detail) — public, unauthenticated.
**Verdict: PASS** — dead job links = 0, closed-role applications accepted = 0.

## Server contract

Both `listPublicPositions` and `getPublicPosition`
(`src/lib/jobs.functions.ts`) enforce the same public predicate:

```
positions
  WHERE status = 'active'
    AND visibility = 'public'
    AND length(description) >= MIN_DESC
    AND jsonb_array_length(requirements) > 0
```

Anything failing that predicate — draft, submitted, approved-but-not-active,
paused, filled, closed, archived, or private/internal — is filtered
server-side. The public server client uses a scoped `TO anon` SELECT policy
with column projection; internal fields (comp weights, hiring plan,
scorecard config, admin notes, applicant_source, requirement scoring,
approver history, `taasflow_internal_notes`) are never selected.

## UI surface parity

| Feature | Implementation | Verified |
|---|---|---|
| Search | Debounced client filter over title + org + description preview | ✅ |
| Location filter | Distinct values from list, chip-clearable | ✅ |
| Work model | Remote / Hybrid / Onsite `Select` | ✅ |
| Employment type | Full-time / Part-time / Contract / Fractional `Select` | ✅ |
| Seniority | Chip filter | ✅ |
| Role cards | Title, org, location, model, chips, published_at | ✅ no internal fields |
| Detail page | `/jobs/$id` — full description, requirements, preferred, comp (only when `compensation.approved`), openings | ✅ |
| Apply CTA | Single primary `<Link to="/jobs/$id/apply">Apply for this role</Link>` | ✅ present on card + detail |
| Copied URLs | Deep links (`/jobs/$id`) resolve via loader; `null` result → notFound | ✅ share preserves state |
| Pagination | `PAGE_SIZE = 20`, page state in URL | ✅ |
| Empty results | Rendered `EmptyState` w/ "Clear filters" | ✅ |
| Mobile | Site shell responsive; cards stack; filters collapse to accordion | ✅ tested at 375×812 |

## Dead-link + closed-role guards

- If a role is closed between list render and detail navigation,
  `getPublicPosition` returns `null` → route `notFoundComponent` shows
  "This role is no longer available" with link back to `/jobs`. Dead
  link count = 0.
- `submitApplication` (`src/lib/apply.functions.ts:69`) revalidates the
  same predicate server-side:
  ```
  pos.status !== "active" ||
  pos.visibility !== "public" ||
  (description/requirement completeness gate)
  ```
  Failing rows throw `Role not available` before any insert. A stale
  form tab attempting to POST against a closed role returns 4xx; no
  application row is created; no CV is stored; no confirmation is shown.
- SEO metadata is set per route with role-specific title/description; no
  detail page inherits a generic hero image that would misrepresent a
  removed role.

## Verification

- Flipped a position `active → closed` while list was open: card
  disappears on refetch; opening the cached deep link renders NotFound;
  attempting to submit the apply form receives `Role not available`.
- Selected all filter permutations against seed data: counts matched
  `SELECT count(*)` reruns of the public predicate.
- Opened `/jobs/$id` for archived, paused, and internal-visibility
  positions: all return NotFound.

**Dead job links: 0. Closed-role applications accepted: 0. Verdict: PASS.**
