# Public Dependency Risks — TaaSFlow V2 Migration Safety Gate

**Trace:** MIG-SAFETY-GATE-2026-07-23
**Mode:** Read-only inspection. No code changes performed.
**Source repo:** https://github.com/joaobogo/sourcing-suite-ai.git — returns HTTP 404 unauthenticated (private or renamed).
**Destination:** https://clear-path-hubs.lovable.app

Companion files: `public-migration-allowlist.json`, `public-migration-denylist.json`.

---

## 1. Access status

Direct byte-level inspection of the source repository was **not possible** this pass — GitHub REST returns 404 for `joaobogo/sourcing-suite-ai` without credentials, and no GitHub connector is linked. The classification below therefore uses the canonical directory layout established by prior migration phases (`source-repository-inventory.md`, `content-inventory.md`, `phase-01-*-comparison.md`) plus the destination mirror in `src/content/`.

This is the same fallback used by earlier `source-repository-inventory.md` and is authoritative for **content and asset scope**; **byte-level file classification of the source repo remains UNRESOLVED** until the repo is made accessible.

---

## 2. Directory classification (canonical layout)

| Source area | Classification | Migration behaviour |
|---|---|---|
| `src/content/pages/**` | CONTENT_ONLY | Allowlist. Copy text bodies only. |
| `src/content/industries/**` | CONTENT_ONLY | Allowlist. |
| `src/content/blog/**` | CONTENT_ONLY | Allowlist minus documented exclusions (drafts, tests, duplicates). |
| `public/assets/**` | ASSET_ONLY | Rehost. No hotlinking. |
| `src/components/marketing/**` | REBUILD_FROM_REFERENCE | Visual reference only. Destination canonical: `src/components/marketing/site-shell.tsx`, `src/components/ds/`. |
| `src/components/site/**` | REBUILD_FROM_REFERENCE | Header/footer visual reference. |
| `src/pages/(public marketing)/**` | REBUILD_FROM_REFERENCE | Copy visible copy + section order. Rewire every CTA to destination canonical routes. |
| `src/pages/dashboard/**` · `src/pages/admin/**` · `src/pages/client/**` · `src/pages/candidate/**` | OLD_DASHBOARD | **Denied.** Destination workspace lives under `src/routes/_authenticated/`. |
| `src/components/{dashboard,admin,client,candidate}/**` | OLD_DASHBOARD | **Denied.** |
| `src/hooks/use{Auth,Dashboard,Admin,Client,Candidate,Realtime}*` | OLD_DASHBOARD / OLD_AUTH / OLD_OPERATIONAL_LOGIC | **Denied.** |
| `src/services/**` | OLD_BACKEND | **Denied.** Replaced by destination `createServerFn` handlers. |
| `src/integrations/supabase/**` · `src/lib/supabase*` · `src/lib/db*` | OLD_BACKEND | **Denied.** Different Supabase project. |
| `supabase/**` (functions, migrations, seeds) | OLD_BACKEND | **Denied.** Destination Supabase is authoritative. |
| `src/lib/auth*` · `src/context/AuthContext*` · `src/components/auth/**` · `src/pages/auth/**` · `src/pages/login*` | OLD_AUTH | **Denied.** Destination auth already ships. |
| `src/pages/jobs/**` · `src/lib/jobs*` · `src/pages/apply*` · `src/services/application*` | OLD_OPERATIONAL_LOGIC | **Denied.** Destination `/jobs*`, `/jobs/$id/apply` canonical. |
| `src/pages/intake*` · `src/services/intake*` | OLD_OPERATIONAL_LOGIC | **Denied.** Destination `/intake` + `/api/public/intake` canonical. |
| `src/services/{parse,enrich,score,publish}*` · `src/lib/scoring*` · `src/lib/kpi*` | OLD_OPERATIONAL_LOGIC | **Denied.** Destination scoring engine + publish desk canonical. |
| `src/services/notifications*` · `src/lib/notifications*` | OLD_OPERATIONAL_LOGIC | **Denied.** Destination realtime + notification lifecycle canonical. |
| `.env`, `.env.*`, `**/*.secret`, service-account JSON | OLD_BACKEND | **Denied.** Secrets never migrate. |
| `qa/**` · `tests/**` · `e2e/**` · `fixtures/**` · `playwright*.config.*` | QA_OR_INTERNAL | **Denied.** |
| `scripts/**` | QA_OR_INTERNAL | **Denied.** |
| `README.md`, `docs/**` (source-side) | REVIEW_REQUIRED | Read-only reference. |

---

## 3. Public-component indirect-dependency risks

Even inside allowlisted marketing paths, the following imports are the common paths by which operational dependencies leak into a public bundle. Any public component that transitively touches one of these is downgraded to **REBUILD_FROM_REFERENCE**:

1. **Supabase client imports** — `@/integrations/supabase/client`, `supabase-js` direct. High-risk in Contact, Newsletter, and Pilot pages.
2. **Auth hooks** — `useAuth`, `useSession`, `useUser`. High-risk in Header ("Sign in" state), Pricing (upgrade CTAs).
3. **Dashboard KPI / data hooks** — `useKpi*`, `useDashboard*`, `useCandidatePipeline*`. High-risk in homepage "live workspace preview" panels.
4. **Realtime hooks** — `useRealtime*`, direct `.channel(...)` calls. High-risk on any "live activity" strip.
5. **Server function imports from `services/**`** — indirect via `useMutation`. High-risk in Contact and Employer Onboarding forms.
6. **Analytics/consent stubs bound to source project ID** — Segment/Posthog init modules. Must be rebuilt on destination env vars.
7. **Hardcoded old-project URLs** — any `taasflow.com` or `sourcing-suite-ai.lovable.app` string in copy/CTAs must be rewritten to destination canonical routes.

Destination guard already in place: `src/config/public-navigation.ts` is the single source of truth for public links, and audited (previous turn) as containing zero old-project URLs.

---

## 4. Reconstruction requirements

Every migrated public page MUST:
- Use destination `SiteShell` / `PublicPageShell` — never a source-side layout component.
- Route every CTA through `src/config/public-navigation.ts` targets (`/intake`, `/jobs`, `/login`, `/contact`).
- Use destination `marketingHead()` for metadata — never a source-side head module.
- For any form, POST to a destination `src/routes/api/public/*` server route (e.g. `/api/public/contact`, `/api/public/intake`). Never call a source-side handler.

---

## 5. Verdict

| Requirement | Status |
|---|---|
| Every relevant source area classified (canonical layout) | ✅ |
| Operational allowlist mistakes | 0 |
| Unexplained files | 0 (directory-level policy is exhaustive; per-file listing pending repo access) |
| No code changes | ✅ 0 code files modified |
| Direct byte-level inspection of source repo | ❌ UNRESOLVED — repo returns 404 |

**Overall: CONDITIONAL PASS.**

The migration policy is enforceable and complete at the directory-and-pattern level: the allowlist admits only content, assets, and visual-reference presentation; the denylist covers every operational surface named in the brief (dashboards, backend, auth, job board, intake, application, parsing, enrichment, scoring, publication, KPI, realtime, notifications, environment files, secrets, QA fixtures). Destination code already respects this boundary — no operational imports exist in public routes (verified in prior audit turns).

Upgrade to full PASS requires either (a) linking GitHub so a per-file `source-repository-files.json` classification can be emitted, or (b) explicit sign-off that the live-site + destination-mirror inventory is the authoritative source (as recommended in `source-repository-inventory.md`).

---

## 6. Counts

- **Files inspected directly:** 0 (source repo returns 404)
- **Files allowed (patterns):** see `public-migration-allowlist.json` — 13 patterns / classifications
- **Files denied (patterns):** see `public-migration-denylist.json` — 44 patterns covering all required categories
- **Public components requiring reconstruction:** all source-side presentation components (REBUILD_FROM_REFERENCE by policy) — destination already re-implements these
- **Indirect operational dependencies detected in destination public routes:** 0 (previous audit)
- **Unresolved files:** entire source tree byte-level — pending repo access
