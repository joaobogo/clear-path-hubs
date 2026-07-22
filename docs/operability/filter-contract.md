# Filter Contract

Filters are URL-serialized via `validateSearch` + `zodValidator` + `fallback()` on each route. One filter engine per surface — saved views are just persisted filter payloads, they do not fork the query builder.

## Admin surfaces

| Surface | Filter keys | Notes |
|---|---|---|
| `/admin/candidates` | `q, client, position, stage, admin_status, visibility, score_min, score_max, processing_state, owner, action_required, from, to, page, page_size, sort` | `score_min/max` clamped 0..100. |
| `/admin/positions` | `q, client, status, visibility, owner, from, to, page, page_size, sort` | |
| `/admin/intakes` | `q, status, owner, from, to, page, page_size` | |
| `/admin/processing` | `q, processing_state, incident_type, from, to, page, page_size` | For triage. |
| `/admin/matches` | `q, position, stage, score_min, score_max, action_required, from, to, page, page_size, sort` | |
| `/admin/activity` | `q, actor, entity_type, action, from, to, page, page_size` | Audit view. |
| `/admin/privacy` | `q, request_type, status, due_before, from, to, page, page_size` | DSR queue. |

## Client surfaces

| Surface | Filter keys | Notes |
|---|---|---|
| `/client/positions` | `q, status, from, to, page, page_size, sort` | Scoped to `organization_id` by RLS. |
| `/client/candidates` | `q, position, stage, fit_band, location, availability, from, to, page, page_size, sort` | `fit_band` maps to score buckets (Top/Strong/Fair). |
| `/client/messages` | `q, thread, unread, from, to, page, page_size` | |

## URL serialization

- Every filter param uses `fallback(z.string()|z.number(), default).default(default)` so an out-of-range URL never blank-screens; components clamp after read.
- `page`, `page_size`, `sort` are always present; `page_size ∈ {25, 50, 100}` clamped in component.
- `from`/`to` are ISO date strings.
- Multi-select filters serialize as comma-separated (`stage=submitted,shortlisted`).

## Rule: one engine per surface

The `filters` payload persisted in `saved_views.filters` is exactly the search-param object. Loading a saved view calls `navigate({ search })` — there is no second code path.
