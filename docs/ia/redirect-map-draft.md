# Redirect Map (Draft)

**Prompt 2 · Public IA — Docs only, no implementation changes.**
Generated: 2026-07-24 · Implementation files changed: **0**.

This is a **draft** for owner approval. Each rule below is a redirect *proposal*, not an active rule. When approved, Prompt 3+ can implement via the TanStack router's `beforeLoad` `redirect()` or an equivalent public-route mechanism. No implementation happens in this prompt.

Owner sign-off required per rule before any implementation.

---

## Draft rules

| # | From (destination path) | To | Type | Reason | Owner call | Dependency |
| - | ----------------------- | -- | ---- | ------ | ---------- | ---------- |
| R1 | `/industries/non-profit` (served by `industries.non-profit.tsx`) | `/industries/non-profit` (served by `industries.$slug.tsx`) | 301 | Dedicated route file duplicates the dynamic-slug pattern. If content is unique, migrate JSON into `src/content/industries/non-profit.json`. After migration, delete the dedicated file so `$slug` serves the URL. | Content | `non-profit.json` exists in content pipeline. |
| R2 | `/resources` → `/knowledge-base` **(only if owner chooses merge)** | `/knowledge-base` | 301 | `/resources` and `/knowledge-base` overlap. Two options: (a) **keep both** with distinct scope (Resources = playbooks / templates / whitepapers; KB = product docs) — no redirect; (b) **merge into KB** — apply R2 and update footer + nav. | Content | Owner picks (a) or (b). Currently defaulted to (a) — keep both. |
| R3 | `/global-talent` | `/talent-network` | 301 | Overlap with canonical candidate landing `/talent-network`. Redirect unless owner confirms distinct content proposition. | Marketing | Confirm no distinct positioning for `/global-talent`. |
| R4 | `/talent-marketplace` | `/talent-network` | 301 | Orphan — not linked from nav, footer, or sitemap. Redirect to canonical. | Marketing | None. |
| R5 | `/dev/catalogue` | (remove from public routing) | n/a | Internal dev catalogue. Options: (a) gate behind auth as `/admin/dev/catalogue`; (b) keep at `/dev/catalogue` but add `robots: noindex` and never link publicly; (c) delete. | Frontend | Owner picks (a), (b), or (c). |
| R6 | Legacy source deep links (any) | Destination canonical | 301 | Placeholder — populate once source `taasflow.com` link inventory is exported. | Marketing | Requires source-side link export (Prompt 1 §7). |

## Non-redirect actions bundled with this map

Not redirects, but should ship together to close orphans and align sitemap:

| # | Action | File | Owner |
| - | ------ | ---- | ----- |
| N1 | Add `/platform`, `/system`, `/trust`, `/candidate-join`, `/candidate-success` to `STATIC_PATHS` in `src/routes/sitemap[.]xml.ts` | sitemap | Marketing |
| N2 | Remove `/auth` from `STATIC_PATHS` — workflow route, must not be indexed | sitemap | Product |
| N3 | Ensure `/share/$token`, `/pitch`, `/jobs/$id/apply`, `/apply/received/$applicationId`, `/intake/confirmation`, `/reset-password`, `/access-denied`, `/unauthorized`, `/login` all emit `robots: noindex` via each route's `head()` | route files | Product |
| N4 | Optional: extend sitemap with published job IDs (mirror `/jobs` loader) and stable blog category slugs | sitemap | Product / Content |

## Owner decision checklist (must-answer before implementation)

1. **R1** — Migrate `/industries/non-profit` content into the JSON pipeline?
2. **R2** — Keep both `/resources` and `/knowledge-base` with distinct scope, or merge?
3. **R3** — Redirect `/global-talent` → `/talent-network`, or scope each distinctly?
4. **R4** — Confirm `/talent-marketplace` → `/talent-network` redirect.
5. **R5** — Gate, hide, or delete `/dev/catalogue`?
6. **R6** — Any legacy source URLs whose link equity we want to preserve? If yes, provide the source URL export.

## Implementation notes (for the prompt that ships this)

- TanStack Start public-side redirects go through `beforeLoad` on the route file (or a wrapper route), returning `redirect({ to: "..." })`. Do **not** use `_redirects` / `netlify.toml` — see `spa-routing-and-redirects` knowledge.
- All 301s must preserve query strings unless explicitly stripped.
- After any redirect ships, update `sitemap.xml` to remove the old path from `STATIC_PATHS`.
- Every redirect must have a corresponding Playwright smoke test that asserts final URL and status.

---

## PASS / FAIL

**PASS** — every proposed redirect has a defined `from`, `to`, `type`, `reason`, and owner call. No rule is implemented in this prompt. Implementation files changed = **0**.
