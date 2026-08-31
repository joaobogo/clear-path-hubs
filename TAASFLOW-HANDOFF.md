# TaaSFlow — engineering handoff

Written for a fresh agent picking up mid-stream. Verified against the repo.

---

## 1. What this is

TaaSFlow (taasflow.com) is a recruiting platform being driven to MVP launch.
Three audiences, three surfaces:

- **Admin** (`/admin/*`) — TaaSFlow staff: score candidates, review evidence,
  approve, publish to clients.
- **Client** (`/client/*`) — the employer: sees published candidates, evidence,
  interview guides, makes decisions.
- **Candidate** (public + `/me/*`) — applies to roles, sees their own profile.

Stack: TanStack Start + React 19, Vite, Tailwind 4, shadcn/Radix, Supabase
(Postgres + RLS), Cloudflare, Vitest, Playwright. Repo `clear-path-hubs`,
remote `git@github.com:joaobogo/clear-path-hubs.git`, branch `main`.

**Scoring engine.** Deterministic, not an LLM: lexical keyword matching plus an
explicit synonym table, reproducible via `input_hash`, immutable score runs,
pinned by a golden-score regression corpus. Current version
`taasflow-scoring-v1.5.2` (`src/lib/scoring/engine-version.ts`).

---

## 2. The goal

Get an external QA audit to **100% pass**. The owner (João) runs a browser agent
against production with admin access; it produces a scored report. We fix what it
finds, it re-runs. We are on audit #6 → #7.

Audit #6 scored **32 PASS / 11 FAIL of 44 (73%)**. Since then ~11 findings were
fixed (section 5); ~16 remain open (section 6).

**Quality bar the owner has set:** flawless UX, no "silly mistakes", MVP-ready.
Not new features — make what already exists correct.

---

## 3. Environment (Windows — these will bite you)

```bash
export PATH="/c/Program Files/nodejs:/c/Users/bmadu/AppData/Local/Microsoft/WinGet/Packages/Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe/bun-windows-x64:$PATH"
```

- **Typecheck:** `NODE_OPTIONS="--max-old-space-size=8192" node node_modules/typescript/bin/tsc --noEmit`
  (NOT `npx tsc` — it OOMs.)
- **Tests:** `npx vitest run` — expect **~1536 passing, 5 failing**. Those 5 are
  environmental (missing `rg`, missing `/bin/bash`, missing
  `SUPABASE_SERVICE_ROLE_KEY`) and predate this work. Do not try to fix them.
- **Lint:** `npx eslint .` reports ~308k errors — almost all `Delete ␍` (CRLF from
  a Windows checkout). **Ignore them. Never run `--fix`** — it would rewrite every
  file and break the Lovable sync. Filter to real rules with `-f json` and drop
  `prettier/prettier`.
- After any `bun install`, re-apply: patch
  `node_modules/@lovable.dev/mcp-js/dist/stacks/tanstack/vite.js` `assertContains`
  for Windows paths, and ensure `.env.local` has
  `LOVABLE_API_KEY=local-dev-placeholder`.
- `sed` mangles backticks and escapes here. Use an editor tool, or `node -e`.

---

## 4. THE deployment gotcha — read this twice

**Pushing to git does NOT deploy.** Lovable ingests every commit (preview
follows), but taasflow.com serves only the last **published** build. The owner
must press **Publish → Update** in Lovable.

This already cost a full day: an audit ran overnight against a pre-fix build and
scored 11%, while the fixes were all correct. Symptom: the audit reports items as
broken that you know are fixed.

`/admin/operations` shows **"Engine running today: vX"** — that line exists
specifically so this can never hide again. Check it before trusting any audit.

**Three owner actions are pending and gate several audit items:**

1. **Publish → Update** — 6 commits pushed, unpublished.
2. **Apply migration** `supabase/migrations/20260828000000_admin_index_position_status.sql`
   — adds `position_status` + staleness columns to `v_admin_candidate_index`.
3. **Run bulk re-score** on `/admin/operations` — every stored run is still v1.5.1
   while the engine is v1.5.2, so engine-level fixes are not visible yet.

---

## 5. What has been fixed (do not redo)

Last commits, newest first:

| Commit | What |
|---|---|
| `60c9ebb0` | Evidence hygiene: CV excerpt no longer prints raw PDF bytes; leading `Links:` strips removed from quotes; a quote must contain prose (drops bare tech lists / section headers); enrichment backfills languages+skills+years onto the profile (gaps only, never overwrites) |
| `175bfda6` | Interview questions read as English (noun-phrase heads, framing-noun stripping); boolean answers stored as text (`"true"`, `"yes"`) render as Yes/No everywhere |
| `0217dca0` | Score parity: unreadable-CV void moved to where the published run is RESOLVED so all surfaces inherit it; scoring-review queue applies the video bonus to both columns and recomputes the band; criteria-version wording unified (the light loader was missing the rubric join) |
| `9673422f` | **Consent (compliance).** RB2B booted from the server-rendered head "independent of any consent UI" AND was separately exempted from the consent loop — "Decline all" did not decline. Both removed. Banner copy corrected: it promised something GA4's consent mode does not do |
| `f5cdb583` | Serial→parallel round-trips on contact badges; a11y label on an icon-only button |
| `283f8301` | Failures that rendered as emptiness: scoring-review had no error component at all; role-fit panel rendered an empty card; open-items strip hid itself (reads as "you have nothing open") |
| `e0c5c1b4` | **4 conditional-hook crash risks** (React "Rendered fewer hooks than expected" → white screen; one fired when a client hired a candidate); dead `{false && …}` block; silent list truncation now labelled; onboarding modal was swallowing preference-save failures |

Earlier work (audits #3–#5): fairness release v1.5.0, evidence honesty v1.5.1,
"no claim without a passage" v1.5.2, Portuguese evidence reaching the client,
unreadable-CV handling, contradiction copy, one date formatter, ~40 smaller items.

---

## 6. What is still open — this is the work

**Blocked on owner actions (not code):**

- Met/Partial rows with no quote — fixed in engine v1.5.2, needs the bulk re-score.
- Quotes that do not support the requirement — same dependency.
- Archived-role candidates carry "Stale" chips — needs the migration.

**Fixed since this document was first written** (all pushed, all with tests
where the defect could silently return):

A6-01, A6-13, A6-14, A6-15, A6-16, A6-17, A6-18, A6-21, A6-23, A6-24, A6-25,
A6-26, A6-27.

**Still open:**

| ID | Problem |
|---|---|
| A6-29 | Assorted copy and data-hygiene nits — not yet worked through |
| A6-14 (part) | The pay range in the screening QUESTION disagrees with the role's stored range. New questions are generated from the range and a `pay_range_mismatch` reason now surfaces on the positions attention queue, but the existing question's text is a data fix and the owner has to confirm the intended number |

Full detail with exact on-screen strings is in the audit #6 PDF at
`C:\Users\bmadu\Downloads\TaaSFlow_Audit6_Report.pdf`. Extract it with the repo's
own `unpdf` (write this to a temp `.mjs` file and run it, to avoid shell quoting):

```js
import fs from "node:fs";
const { extractText, getDocumentProxy } = await import("./node_modules/unpdf/dist/index.mjs");
const buf = fs.readFileSync("C:/Users/bmadu/Downloads/TaaSFlow_Audit6_Report.pdf");
const pdf = await getDocumentProxy(new Uint8Array(buf));
const { text } = await extractText(pdf, { mergePages: true });
fs.writeFileSync("audit6.txt", text);
```

---

## 7. The dominant defect class

Nearly every finding across six audits is one of these four. Look for them first:

1. **Two surfaces answering the same question differently.** A score, a count, a
   band, a date, a state, a name — if it appears twice, compare them. The root
   cause is almost always two code paths resolving the same fact independently.
   The fix is one resolver, not two patched renderers.
2. **A guard that can never fire.** `{false && …}`, a `??` that short-circuits a
   hook, a threshold nothing reaches, a filter reading a column the query never
   selected.
3. **A claim with no evidence behind it.** A verdict with no quote; a count with
   no rows; "0 failures" beside a visibly failed thing.
4. **Failure rendered as emptiness.** A panel that hides itself on error reads as
   "nothing here" — the one state a user cannot recover from.

---

## 8. Conventions

- **Fix at the source, not per surface.** If two pages disagree, make one read the
  other's resolver. Patching both is how the bug comes back.
- **Comments explain the defect, not the code.** Every fix carries a short comment
  naming what went wrong and which audit found it. Match that style.
- **Pin behaviour with a test** when the defect could silently return — including
  source-level assertions. Several defects were exemptions and head snippets that
  no test of the public API would have caught.
- **Golden-score gate.** Changing the engine moves
  `src/lib/scoring/__tests__/golden/score-corpus.json`. Review the diff first; if
  only `engine_version` and `input_hash` moved, accept with
  `ACCEPT_GOLDEN=1 npx vitest run src/lib/scoring/__tests__/golden-scores.test.ts`.
  If a *score* moved, understand why before accepting.
- **Bump `ENGINE_VERSION`** whenever the engine can produce a different number for
  the same inputs — `input_hash` includes it and rescore reuses runs whose hash
  matches. Without a bump, "rescore everyone" silently returns old scores.
- **Repo guard tests will catch you** — admin-nav coverage, route-state coverage,
  client vocabulary, public vocabulary, KPI sync, internal links, employer-view
  manifest. Run `npx vitest run` before committing. Also
  `node scripts/check-client-vocabulary.mjs` and `node scripts/check-kpi-sync.mjs`.
- **Never fabricate** case studies, testimonials, results or client logos.
- **Client-facing copy** must carry no internal vocabulary: no "scoring run",
  "rubric", "engine version", "input hash", "match id", no `cv:123-456` offsets.

---

## 9. Key files

| Path | Role |
|---|---|
| `src/lib/scoring-engine.server.ts` | The deterministic engine |
| `src/lib/scoring/engine-version.ts` | Version + changelog of every engine release |
| `src/lib/scoring/published-score.ts` | **The** published score/band resolver, video bonus, unreadable-CV void |
| `src/lib/scoring/term-synonyms.ts` | Synonym table (incl. Portuguese surface forms) |
| `src/lib/client-kpi.server.ts` | Client-facing candidate DTO |
| `src/lib/client/evidence-relevance.ts` | Whether a passage supports a requirement |
| `src/lib/evidence/quote-hygiene.ts` | Quote cleaning: PII, banners, link strips, mojibake, prose requirement |
| `src/lib/pipeline-runner.server.ts` | parse → enrich → score pipeline |
| `src/lib/format/datetime.ts` | The one date/time formatter (workspace timezone) |
| `src/lib/humanize-codes.ts` | Enum → human label |
| `src/lib/human-labels.ts` | Answer / language / work-auth formatting |
| `src/lib/client/interview-question-phrasing.ts` | Requirement label → interview question |
| `src/lib/tracking/pixels.ts` | Trackers + consent gating |

---

## 10. Suggested first move

1. Read `/admin/operations` "Engine running today" — confirm what is actually live.
2. Extract the audit #6 PDF (section 6) and read the A6-13…A6-29 detail.
3. Start with **A6-14** (raw Markdown on a client-facing role brief) and **A6-01**
   (two client surfaces disagreeing) — both are visible to paying customers.
4. Typecheck + full test run before every commit. Push, then tell the owner to
   **Publish → Update**, or the work is invisible.

---

## 11. One caution

Several "failures" in the last audit were correct code reading stale data. Before
concluding something is broken, check whether it depends on the bulk re-score or
the migration in section 4. Fixing already-correct code is the most expensive
mistake available here.
