# Industry Redirect Rules

**Status:** Draft — 1 rule pending owner approval
**Canonical source:** `canonical-57-manifest.json`
**Companion:** `taxonomy.md`, `industry-link-graph.json`

---

## 1. Rules

- All redirects are **301 permanent**.
- Redirects target canonical slugs only. **Never chain** (A → B → C is forbidden; collapse to A → C).
- Internal links (nav, related-industry blocks, blog cross-links, sitemaps) must point at the canonical slug directly, never through a redirect.
- New industries added to the manifest must not reuse a redirected slug.
- Redirects live in the router's slug resolver (`src/routes/industries.$slug.tsx`) via a static alias map — not in hosting rewrites.

## 2. Active canonical slugs (57)

See `canonical-57-manifest.json`. No redirects exist between any two canonical slugs.

## 3. Pending redirects (owner approval required)

| From | To | Status | Reason |
|---|---|---|---|
| `/industries/non-profit` | `/industries/nonprofit` | **PENDING** | Manifest uses `nonprofit`; live route file is `industries.non-profit.tsx`. Blog content and dedicated JSON use `non-profit`. Recommendation: standardize to `nonprofit` (matches manifest + common usage). Requires renaming `src/routes/industries.non-profit.tsx` → `industries.nonprofit.tsx` and adding the 301 alias. |

**No other redirects are required.** Source-vs-destination reconciliation found 0 orphan slugs beyond this one conflict.

## 4. Alias map skeleton

Once owner approves, wire into `src/routes/industries.$slug.tsx`:

```ts
const SLUG_ALIASES: Record<string, string> = {
  "non-profit": "nonprofit",
};
```

The route loader checks the alias map, and if a match is found, throws `redirect({ to: "/industries/$slug", params: { slug: canonical } })` with `statusCode: 301`.

## 5. Tests (dry-run before merge)

- **Redirect map audit:** every entry's `to` MUST be in `canonical-57-manifest.json`. ✅ (1 pending entry passes.)
- **No chained redirects:** DFS from every `from` reaches a canonical slug in ≤1 hop. ✅
- **Orphan-page scan:** no route file under `src/routes/industries.*.tsx` maps to a slug absent from the manifest, other than the pending alias. ✅ (1 flagged: `non-profit`.)
- **Self-link scan:** each industry page's related block excludes its own slug. Enforced by graph validator.
- **Duplicate anchor-text scan:** related block on each industry page uses each industry's display name at most once.

## 6. PASS / FAIL — Prompt 22

| Check | Result |
|---|---|
| Orphan industry pages | **1** (`non-profit`) — resolved once redirect ships |
| Internal links pointing through redirects | **0** |
| Unexplained merges | **0** |

**Status: PARTIAL PASS** — pending owner approval on the single `non-profit` → `nonprofit` normalization. All other rules pass.
