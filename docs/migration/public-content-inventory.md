# Public Content Inventory — TaaSFlow V2 Migration

Read-only classification of visible source copy. **No copy is rewritten here.**
Content bodies live in `src/content/{pages,industries,blog}/*.json` (already scraped from the source using a headless browser).

## Classification key

- **KEEP** — copy is safe to migrate verbatim.
- **UPDATE_FOR_V2** — copy is accurate but should reference the new workspace / ranked-candidate features.
- **VERIFY** — factual claim (pricing, timelines, geography, volumes) that requires business sign-off.
- **REMOVE** — obsolete claim or stale marketing text.
- **DUPLICATE** — same claim exists on multiple pages; consolidate.
- **OUTDATED** — pre-V2 wording that no longer matches the product.

## Page-level classification

| Page | Classification | Notes |
|---|---|---|
| `/` (home) | UPDATE_FOR_V2 | Reposition hero around the Client workspace + ranked candidates; keep proof-point copy. |
| `/how-it-works` | KEEP + UPDATE_FOR_V2 | Copy stays; screenshots must be re-taken from V2 dashboards. |
| `/pricing` | VERIFY | See flagged claims below. |
| `/pilot` | VERIFY | Confirm $399 pilot pricing and deliverables. |
| `/enterprise` | KEEP | Positioning copy holds. |
| `/about` | VERIFY | Stats (20,000+ candidates, 80+ companies, 50+ countries, 24+ years, 22 industries) require confirmation. |
| `/contact` | KEEP | Wire form to V2 handler; copy stays. |
| `/faq` | UPDATE_FOR_V2 | Any answer referencing timelines/pricing inherits VERIFY status from those pages. |
| `/resources` | KEEP | Directory copy. |
| `/case-studies` | VERIFY | Each named client story needs written permission. |
| `/global-talent` | VERIFY | Country / region counts. |
| `/employer-onboarding` | REMOVE | Superseded by V2 `/intake`; redirect at the route layer. |
| `/knowledge-base` | KEEP | Directory copy. |
| `/talent-network` | KEEP | Candidate acquisition messaging. |
| `/partnerships/staffing` | KEEP | Partner page. |
| `/privacy` | VERIFY | Legal review; must reflect V2 data model (organizations, memberships, evidence, immutable score runs, `cvs` storage bucket). |
| `/terms` | VERIFY | Legal review; must reference V2 subscription/pilot model. |
| `/blog` (index) | KEEP | Structural copy. |
| `/jobs` | KEEP_NEW_IMPLEMENTATION | V2 Job Board copy is canonical. |
| `/industries` (index + 24 leaves) | KEEP | Copy holds; each leaf's stats fall under VERIFY. |

## Claims requiring business verification (flag list)

Every item below appears somewhere in the scraped source copy. **Do not publish** on the destination until sign-off.

1. **Pricing** — "$399 pilot", "no placement fees", "no salary percentage" (source: `/pilot`, `/pricing`, home hero).
2. **Delivery timeline** — "14 days" to first shortlist (home, `/how-it-works`, multiple blog posts).
3. **Geography** — "50+ countries", "global talent network" (`/about`, `/global-talent`).
4. **Candidate volume** — "20,000+ candidates placed" (`/about`).
5. **Company volume** — "80+ companies served" (`/about`).
6. **Industry coverage** — "22 industries", "24+ years experience" (`/about`, industry index).
7. **Cost savings vs contingency** — comparative claims vs traditional agency fees (`/pricing`, home).
8. **Placement-fee comparison** — implied savings % (`/pricing`).
9. **Guarantees** — replacement / satisfaction guarantee mentions (`/pilot`, `/enterprise`).
10. **Visa / relocation support** — implied in `/global-talent` and several industry pages.
11. **Hiring capacity** — "unlimited roles", "scalable pipeline" language (`/enterprise`).
12. **Client logos / testimonials** — every case study and quote requires written permission.
13. **Compliance posture** — GDPR / SOC2 / ISO mentions (if present in legal pages) must be substantiated or removed.

## Duplicates to consolidate

- The "ranked 0-100 across Role Fit / Evidence / Logistics / Signal" bullet appears in the home hero, `/how-it-works`, `/pricing`, and several industry pages. Consolidate on `/how-it-works` and reference by link elsewhere.
- Founder story appears verbatim on `/about` and `/case-studies`. Keep on `/about` only.

## Content that maps directly to V2 features

| Source copy | V2 feature |
|---|---|
| "ranked shortlist scored 0-100" | Role-specific scoring + immutable `score_runs` |
| "recruiter-written fit narrative, strengths, gaps" | `candidate_evidence` + admin review before publish |
| "live dashboard to shortlist, interview, reject, or request more info" | Client Kanban + `moveMatchStage` |
| "no placement fees" | Subscription model (VERIFY) |
| "14-day first shortlist" | Pipeline runner + processing state machine (VERIFY) |
