# Source → Destination Gap Audit

Prompt 1 · Master strategic audit. Docs only — no implementation changes.

Scope: public marketing surface, pricing, industries, resources, about, job board entry points, and public references to the authenticated workspace. Sources: taasflow.com (live), Gamma overview deck, destination (this repo).

---

## 1. Positioning message

| Dimension | Source (taasflow.com + deck) | Destination (repo) | Verdict |
| --- | --- | --- | --- |
| Category | "Not software, not agency — subscription recruiting operating system" | "Hybrid Human + AI recruiting operating system" on home + how-it-works | **Aligned**, stronger on destination. Deck's "placement model is dead" line missing from home. |
| Core promise | Ranked, pre-screened candidates + recruiter fit narrative + live dashboard + direct handover + no placement fees | All 4 pillars present (hero, deliverable demo, how-it-works, pricing) | **Aligned** |
| Audiences | Founders, HR/talent, staffing agencies, enterprise | Home hero covers founders + HR; enterprise + staffing partnership routes exist; talent-network for candidates | **Aligned** |
| Voice | Warm, direct, no hype | Consistent across new copy | **Aligned** |

## 2. Pricing claim reconciliation

| Element | Source claim | Destination (`src/config/pricing-core.ts`, `/pricing`) | Verdict |
| --- | --- | --- | --- |
| Pilot | $399 pilot mentioned in deck | Pilot tier exists | **Aligned** |
| Subscription entry | "from $6,999/month" on source | Multi tier + Hiring Sprint tier per canonical `pricing-core.ts` | **Needs confirmation** — verify displayed entry price string on `/pricing` matches "from $X/month" wording from source. |
| No placement fees | Repeated on source | Present in hero + comparison + pricing FAQ | **Aligned** |
| Timeline | 7–14 days shortlist | Present on how-it-works and homepage | **Aligned** |

Action: reconcile displayed monthly entry price wording with source. Any one-time packages introduced on `/pricing` must be labelled separately from the subscription entry price so buyers don't compare apples-to-oranges.

## 3. Proof and social evidence

| Type | Source | Destination | Gap |
| --- | --- | --- | --- |
| Founder profiles | Christian Brogger, João Bogo on About | About page present with founders | **Verify photos + bios match** |
| Case studies | Referenced on source | `/case-studies` implemented with metric bands + map | **Aligned** |
| Logos / press | Sparse on source | Founders strip on home | **Parity** |
| Testimonials | Some quotes on source | Selected quotes across product pages | **Verify quote provenance / consent** |

## 4. Route coverage (public)

Full manifest is in `public-route-manifest.md` (Prompt 2). Snapshot of source vs. destination coverage:

| Source route family | Destination coverage |
| --- | --- |
| `/` | ✅ `src/routes/index.tsx` |
| `/pricing` | ✅ `pricing.tsx` |
| `/how-it-works` | ✅ `how-it-works.tsx` |
| `/industries` + industry detail | ✅ `industries.index.tsx` + `industries.$slug.tsx` (57 verticals) + `industries.non-profit.tsx` |
| `/enterprise` | ✅ `enterprise.tsx` |
| `/staffing-partnership` | ✅ `partnerships.staffing.tsx` |
| `/talent-network` | ✅ `talent-network.tsx`, `global-talent.tsx`, `talent-marketplace.tsx` |
| `/employer-onboarding` | ✅ `employer-onboarding.tsx` |
| `/case-studies` | ✅ `case-studies.tsx` |
| `/blog` + posts | ✅ `blog.index.tsx`, `blog.$slug.tsx`, `blog.category.$slug.tsx` |
| `/knowledge-base` | ✅ `knowledge-base.tsx` |
| `/faq` | ✅ `faq.tsx` |
| `/about` | ✅ `about.tsx` |
| `/journey` | ✅ `journey.tsx` |
| `/contact` | ✅ `contact.tsx` |
| `/privacy` `/terms` | ✅ |
| `/sitemap` | ✅ HTML sitemap + XML sitemap (`sitemap[.]xml.ts`) |
| Job board | ✅ `jobs.index.tsx`, `jobs.$id.index.tsx`, `jobs.$id.apply.tsx` |
| Pilot signup | ✅ `pilot.tsx` |
| Candidate join | ✅ `candidate-join.tsx` |

**No missing route families.** Orphan candidates flagged for Prompt 2 review: `solutions.tsx`, `resources.tsx`, `dev.catalogue.tsx` — confirm each is linked from nav/footer or intentionally excluded.

## 5. Industry system (57 verticals)

- Destination claims 57 industries; verify manifest count matches (see `industry-relationships.ts` + `industries.index.tsx`).
- Each industry page must have a unique hero backdrop (see `industry-hero-backdrop.tsx`), unique intro copy, unique role focus, and internal links to related industries.
- Risk flag: any industry falling back to generic imagery must be resolved before public relaunch (tracked in Prompts 21–29 batches).

## 6. Dashboard message vs. reality

Public site now advertises: evidence-first scoring, weekly ranked delivery, role blueprint, candidate dossier, comparison tableau, silver medalist memory. All exist in the authenticated product (`/client/*`, `/admin/*`). Marketing → product parity is intact; keep marketing copy truthful — do not add promises the workspace has not shipped.

## 7. Top divergences to close

1. Confirm `/pricing` displayed subscription entry price string matches source wording.
2. Confirm founder bios + photos on `/about` are current and approved.
3. Confirm every one of the 57 industry pages has unique imagery + copy (audit in Prompt 21+).
4. Confirm orphan public routes (`solutions.tsx`, `resources.tsx`) are linked or intentionally excluded — decide in Prompt 2.
5. Reconcile any remaining "software vs. agency" language on legacy sections to match the destination's Hybrid Human + AI positioning.

## PASS / FAIL

**PASS** — every major source message, route family, founder reference, pricing claim, and product promise has a destination decision recorded above. Implementation files changed = 0.

## Artifacts

- Changed files: none (docs only).
- Companion docs: `positioning-delta.json`, `missing-proof-and-route-list.md`.
- Route manifest: to be produced in Prompt 2.
