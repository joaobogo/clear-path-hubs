# The Run, phases 4 to 6: the specification

Distilled from the owner's document *TaaSFlow, redesigned. Version 3, white and blue* (Parts 5 to 7). That document is not in the repository; this file is the source for Lovable. Rules in `docs/handoff/lovable-house-rules.md` override anything here (in particular: no booking, no client interview or offer actions, no per-position prices, no typed numbers).

---

## A. Industry pages (phase 4)

### A1. Nine hiring models
Seven weights per model, always in this fixed segment order:
`skills` (skills and tools), `experience` (relevant experience), `context` (industry context), `seniority` (seniority and scope), `credentials` (credentials and licences), `languages`, `location` (location and logistics). Each set totals 100.

| Key | Name | skills | experience | context | seniority | credentials | languages | location | Raised | What decides |
|---|---|---|---|---|---|---|---|---|---|---|
| stack-led | Stack-led | 35 | 20 | 10 | 15 | 5 | 5 | 10 | skills | Depth in the actual stack decides. Credentials count least. |
| site-led | Site-led | 25 | 20 | 15 | 10 | 15 | 5 | 10 | credentials, location | An expired ticket or an unworkable commute ends the match. |
| regulation-led | Regulation-led | 25 | 20 | 20 | 15 | 10 | 5 | 5 | context | Sector vocabulary and regulation do not transfer. |
| licence-led | Licence-led | 20 | 20 | 15 | 10 | 25 | 5 | 5 | credentials | A missing licence is a hold, not a low score. |
| practice-led | Practice-led | 20 | 25 | 15 | 15 | 15 | 5 | 5 | experience | The work actually done outranks the firm name. |
| motion-led | Motion-led | 25 | 25 | 20 | 15 | 5 | 5 | 5 | experience, context | A selling motion rarely carries across segments. |
| channel-led | Channel-led | 25 | 20 | 15 | 15 | 5 | 10 | 10 | languages, location | Channel and category depth matter more than titles. |
| shift-led | Shift-led | 20 | 20 | 15 | 10 | 5 | 15 | 15 | languages, location | Languages and location decide who can work the shift. |
| qualification-led | Qualification-led | 20 | 20 | 15 | 10 | 20 | 5 | 10 | credentials | Qualified status is often a condition of the role. |

The model names are the document's suggestions; the owner may rename them. The weights are the ones already on the live pages.

### A2. Which model each of the 57 pages uses (repository slugs)
| Model | Slugs |
|---|---|
| stack-led (13) | ai-ml, cybersecurity, data-analytics, design, devops, edtech, gaming, product-management, proptech, saas, tech, telecom, web3 |
| site-led (11) | agriculture, architecture, automotive, aviation, construction, defense, energy, logistics, manufacturing, oil-gas, renewable-energy |
| regulation-led (8) | accounting, finance, fintech, insurance, investment-banking, private-equity, venture-capital, wealth-management |
| licence-led (5) | biotech, healthcare, healthtech, medical-devices, pharmaceuticals |
| practice-led (5) | consulting, human-resources, legal, real-estate, staffing-agencies |
| motion-led (3) | customer-success, marketing, sales |
| channel-led (4) | ecommerce, fashion, media, retail |
| shift-led (4) | food-beverage, hospitality, sports, travel |
| qualification-led (4) | education, higher-education, nonprofit, public-sector |

Source content for every slug today: `src/content/industries-v2.ts` (25 entries) and `src/content/industries-batch2.ts` (32 entries), with `src/content/industry-config.ts`, `src/content/industry-archetypes.ts`, `src/content/industry-hero-images.ts`. Public slugs pass through `src/lib/marketing/industry-slug-aliases.ts`.

### A3. Three tiers, in this order
1. Lead (8 pages, full content, photographs, role pages): hospitality, healthcare, logistics, then food-beverage, travel, retail, manufacturing, construction.
2. Correct: the other indexable pages. Price, promise and blueprint brought into line.
3. Template: the rest, rebuilt from data, kept out of search (`noindex, follow`) until each passes the checks in A8.

Today only hospitality and healthcare are indexable (`INDEXABLE_INDUSTRY_SLUGS` in `src/lib/seo/indexability.ts`).

### A4. Two small files per page
Model file, one of nine: `src/config/models/<key>.json`
```json
{
  "key": "shift-led",
  "name": "Shift-led",
  "weights": { "skills": 20, "experience": 20, "context": 15, "seniority": 10, "credentials": 5, "languages": 15, "location": 15 },
  "raised": ["languages", "location"],
  "why": "Languages and location are raised because they decide whether someone can work the shift.",
  "intake": ["Working languages and level", "Property or venue type and scale", "Availability across shifts, weekends and peaks", "Service standard"],
  "controls": ["Reviewer approval before client visibility", "Separate contact release", "Full audit trail"]
}
```
Industry file, one of 57: `src/config/industries/<slug>.json`
```json
{
  "slug": "hospitality",
  "name": "Hospitality & Events",
  "group": "Consumer & Service",
  "model": "shift-led",
  "headline": "Hospitality and events hiring, calibrated per property and format.",
  "settings": "Hotels, food and beverage, guest experience, events, multi-location operations and seasonal demand.",
  "exampleRole": "Front office manager",
  "exampleRoles": ["Front office manager", "Line cook", "Housekeeping supervisor", "Events coordinator"],
  "checks": [ { "title": "Property, segment and format fit", "captured": "..." } ],
  "priorities": [ { "name": "Property portfolio", "strong": "...", "watch": "..." } ],
  "families": [ { "name": "Hotels", "roles": [ { "title": "General manager", "required": ["..."], "scored": ["..."], "ask": ["..."] } ] } ],
  "blueprint": { "role": "Front office manager, city hotel", "must": ["..."], "dealbreakers": ["..."], "questions": ["...", "..."] },
  "questions": [ { "q": "Do you cover both hotels and restaurants?", "a": "..." } ],
  "run": "hospitality",
  "photo": "/images/run/hospitality.webp",
  "indexable": true
}
```
Rules the files and template enforce:
- Price, days, seats and channels are never in these files. They come from `src/config/offer.ts`.
- Weights total 100 or the test suite fails.
- `blueprint` is optional. No blueprint, no blueprint block. A blueprint's role must belong to one of this industry's own families.
- A role card draws only the columns it has. A role with nothing written is not listed.
- No role card contains a sentence that appears on a card in another industry (a test checks this).
- `checks` has four entries; `priorities` has five, the first written in full (strong and watch), the rest names only.
- `questions` has five, in the owner's words, taken from the existing FAQs.
- Example roles, sample evidence lines and related industries are never shared between industries.

### A5. Industry page template: eight blocks, top to bottom
| # | Block | Surface | What it does | Content from |
|---|---|---|---|---|
| 1 | Hero | white (`.day`) | h1 = industry headline; one sentence of settings; RoleInput pre-filled with `exampleRole` plus three more roles as chips; the RubricCard (seven weights as a signature bar and a list, "raised" beside raised weights, the model's `why` sentence). ConvergenceField seeded by the industry name with seven surviving lines, each ending on one rubric line (desktop only; on a phone the card sits on plain white). | industry file, model file |
| 2 | Four facts | white | Role families (count), channels, days, pilot price | industry file, `offer.ts` |
| 3 | What a generic recruiter misses in [industry] | tint (`.tint`) | Four numbered checks written as what is captured; one scoring priority in full with EvidenceStrip glyphs (solid = scores, hatched = becomes a question); the other four priorities as chips | `checks`, `priorities` |
| 4 | Role families | white | Families listed on the left, roles as chips, one role card open with three columns: usually required, what we score, what we will ask about | `families` |
| 5 | Start from a blueprint, not a blank page | tint | The blueprint as a document on paper (`.paper`): must-haves, dealbreakers in coral, two screening questions; beside it what intake asks for. Button "Start from this blueprint" opens `/intake?role=<blueprint role>` | `blueprint`, model `intake` |
| 6 | One run | white | A representative run from this sector on the day axis (reuse the Proof chapter's run row), labelled "A representative engagement for this sector", linking to the case study | `run` key into `SAMPLE_RUNS` / `src/content/case-studies.ts` |
| 7 | Questions, and scored in a similar way | white | Five questions as one ruled list, first open (also emitted as FAQ structured data). Four industries with their signatures: three on the same model, one nearest other model | `questions`, model neighbours |
| 8 | Closing band | blue | Shared ClosingBand with this page's example role in the input | shared |

Not on the page: booking forms, a second set of buttons, platform configuration, integrations lists, skills and tools lists. Length about 4,800 px at desktop. One primary label used twice (hero and band). Breadcrumbs: Industries > [Industry] > [Role].

Search structure: title "[Industry] recruiting on a flat fee | TaaSFlow"; one h1 (the headline); blocks are h2; role names h3; FAQ markup from block 7; breadcrumb markup; no price markup. The four checks, the weights and the blueprint are plain text in the page so an assistant can quote them.

### A6. Industries hub (`/industries`)
- h1 "Find your industry. See what we score." Supporting line: "57 industries, each with its own role families and evidence rules. Type the role you are hiring and go straight to the right one." (the count read from the number of industry files). Button "Find my industry".
- The RoleInput is the search: typing "line cook" suggests the industry and role family it belongs to. Typing any role listed on any industry page finds it.
- A panel of the nine models, each with its signature and how many industries use it; selecting one filters.
- The six groups as chips with counts; Consumer & Service first. The groups are the existing hub families: `FAMILY_LABEL` and `INDUSTRY_ARCHETYPE` in `src/content/industry-archetypes.ts` (Digital Systems, Health & Life Sciences, Finance & Regulated Professions, Built Environment & Operations, Consumer & Service, Knowledge, Growth & Creative). The `group` field in each industry file copies that label; do not invent new groups and do not use the older `category` field.
- IndustryCard: name, one line on what is scored, the RubricSignature, the model name, number of role families. No icon, no illustration.

### A7. Role pages (`/industries/<slug>/<role>`)
Only where `src/config/roles/<slug>--<role>.json` exists, written by a recruiter. Never generated to fill a list. Start with about twelve in the lead tier. The slug `briefing` is reserved (existing route).
- h1 "[Role] hiring, scored on [three things]." Left: the blueprint in three ruled columns, the five days on a RunClock. Right, always in view: the blue order card with the role filled in ("Start from this blueprint", leading to `/intake?role=`), and a three-row preview of what arrives on Day 5 (labelled representative).
- Done when the blueprint on the page is the one Intake opens with.

### A8. A page is ready (indexable) when all eight are true
1. Price, days and channel count match Pricing (they come from `offer.ts`).
2. The blueprint's role belongs to this industry.
3. No role card repeats text from another card.
4. The five scoring priorities each have a strong signal and a watch-out.
5. Each industry links to its three model neighbours and its case study.
6. The weights total 100 and name their model.
7. The page text contains no builder instruction.
8. The share card shows this industry's headline.
Indexable is decided per page in the industry file (`"indexable": true`) and only when all eight hold.

### A9. Share cards
1200 by 630. Wordmark and "Hiring, handled.", the industry headline, the rubric card, the field drawn for that industry. No icon. Text readable at phone size. One per industry, plus one per page type (home, pricing, pilot, results, agents, platform, how a role runs).

### A10. New components for phase 4
`src/components/signature/rubric-signature.tsx` (seven segments, widths proportional to weights, raised segments darker blue, accessible text list), `src/components/signature/rubric-card.tsx`, `src/components/data/industry-card.tsx`, `src/components/data/role-card.tsx`, `src/components/data/blueprint-doc.tsx`, `src/components/industry/industry-template.tsx`.

---

## B. Workspace (phase 5)

### B1. How it differs from the site
White and paper. Compact: 14 px text, 44 to 52 px rows, 24 px page padding, 16 to 20 between boxes. No display type: page titles 26 px wide; big figures stop at 54 px. Content in white boxes, 12 px radius, hairline border. The one tinted panel on any screen is the agent log. Ink is rare: a signed shortlist, a confirmed requirement, the count of decisions waiting for a person. One blue button per screen, top right of the content.

### B2. The shell
Existing file: `src/components/workspace/workspace-shell.tsx` (keep its navigation items, permissions, org switcher, global search, collapse and mobile drawer behaviour).
Rail 232 px, white: wordmark, a blue "Run a new role" (to the existing new-role route), the destinations, account, the signed-in person. Current item on pale blue (`--blue-50`). Collapses to icons below 1280. Top bar 60 px, white: breadcrumb left, search right. Three audiences, one shell: client, recruiter (admin), candidate (`/me`).

### B3. Screens
| Screen | Route today | Question it answers | Leads with |
|---|---|---|---|
| Overview | `_authenticated/client.index.tsx` | What needs me today, and what happened overnight? | At most three decision cards (ink border only when a recruiter's sign-off created it, one button each, only the first blue), roles table (stage as four segments, run clock, the four funnel numbers in fixed order, evidence coverage, next step in words), agent log on tint (newest first, three counts above, blue time, bold fact, the role). Empty: "No roles running. Type a job title to start one." with the RoleInput in place of the table. |
| Role | `_authenticated/client.positions.$id.tsx` | Where is this search, and who came out of it? | Header with role title, four facts as chips including the locked rubric version, run clock, seal when signed. Lifecycle bar of nine stages (Intake, Blueprint, Discovery, Evidence, Scoring, Review, Interview, Decision, Hire): done blue, waiting-on-a-person ink. ConvergenceField seeded by the role with this role's own four counts. Top 10 with EvidenceStrip and source. Right column: reach by channel as blue bars (only if per-channel data exists; the bars must total "reached") and the rubric with weights, read-only once locked. |
| Candidate | `_authenticated/client.candidates.$id.tsx` | Why is this person scored as they are? | Left: the CV as text, every sentence that earned points outlined in blue. Right: requirements in rubric order, each with its quote, status and points; selecting one lights its sentence. A recruiter-confirmed requirement carries an ink dot; the recruiter's note closes the list beside the seal. Decisions: the existing DecisionBar (`src/components/client/decision-bar.tsx`) restyled: "Shortlist this candidate" blue, "Decline for this role" outline, existing undo kept. |
| Compare | candidates list compare (existing if present) | Which of these, on what evidence? | Requirements down the side with weights, up to four candidates across; each cell holds the strip segment, the quote or the gap, and the points. Strongest evidence per requirement on `--blue-50`; ties not shaded. Coral for a conflict inside one CV. The existing decision actions sit under each column. |
| Billing | `_authenticated/client.plan.tsx` | What did I buy, what is used, what would more cost? | The Receipt from Pricing marked paid, with the $0.00 lines. Usage: positions as segments, seats, access end date. The PackageSelector showing package totals (never per position). No payment action: "Talk to us about more roles" goes to `/contact`. |
| Recruiter sign-off | admin publish and review screens (`admin.publish.tsx`, `admin.review.$matchId.tsx`, `admin.approvals.tsx`) | Is this list ready to carry my name? | The proposed finalists: strip, score, quotes checked, the recruiter's one-line note, whether it has been opened. Four checks with ink ticks. The sign button is ink (the only ink button in the product), disabled until every finalist has been opened and has a note; pressing it calls the existing release action and shows the Seal with the recruiter's name and the time. What the agents flagged, on tint. |
| Candidate portal | `_authenticated/me.*` | My applications, open roles, profile | They see their own strip and the questions they will be asked, where that data exists. |

### B4. Rules in code
- A score always renders with its EvidenceStrip.
- Funnel numbers always in the order reached, matched, scored, signed.
- Time as "Day n, hh:mm" from the approved brief.
- Ink only through the Seal and the sign-off button.
- No shortlist is visible to a client until it is released through the existing gate (`client_visible` / `released_at`). Do not change that gate.
- Points in a candidate's list add up to the score in the header. Every quote can be found word for word in the CV text.

---

## C. The rest (phase 6)

### C1. Pages and copy
| Page | Route | Headline | Supporting line | Button |
|---|---|---|---|---|
| How a role runs | `/how-it-works` | From brief to ten candidates in four moves. | One role, one clock. What happens on each day, who does it, and what you see while it happens. | Start a $699 pilot |
| Platform | `/platform` | (keep the live headline, rewritten in sentence case) | The eight modules and nine stages, as on the live page | Start a $699 pilot |
| Agents | `/agents` | (keep the live headline) | The eight agents and thirteen limits, as on the live page; 26 agents and 23 channels from `offer.ts` | Start a $699 pilot |
| Enterprise | `/enterprise` | (keep the live headline) | No Bronze, Silver or Gold table and no second price list: link to `/pricing`; 100+ positions scoped with the account team; "Send us a message" | Send us a message |
| Results | `/case-studies` | Six runs, day by day. | One per sector, on the same clock. Representative figures for each vertical. | Run your role |
| Case study | `/case-studies/<slug>` (new) | The engagement's headline | CaseStudy template: situation, roles, RunLog on the day axis, what was delivered, labelled example engagement | Start a $699 pilot |
| About | `/about` | (keep the live headline) | Founders with their existing photos, quotes and bios; four principles | Start a $699 pilot |
| Candidates | `/jobs`, `/talent-network`, `/candidate-join` | Open roles, and what each one is scored on. | You see the requirements before you apply. | Search roles |
| Guides | `/resources/<slug>`, `/blog/<slug>` | (article titles) | Article layout: one column of 680 px, Archivo, figures and tables on tokens | none |
| Not found | `notFound.tsx` | This page is not running. | The address may have changed. Your role can still run. | Run this role |

When `/platform` is rebuilt, the header's fifth link changes from "Agents" to "Platform" (`src/config/public-navigation.ts`, `PRIMARY_ITEMS`).

### C2. Three emails
Brief approved, shortlist signed, weekly summary. Each opens with a short field image and one sentence, then the four funnel numbers (the first three blue, the last ink), then one blue button. The subject is the fact: "Your top 10 for Registered nurse is signed." Rendering lives in `src/lib/notifications/subject-body.ts`, `src/lib/digest/weekly-digest.server.ts`, `src/lib/welcome-email.server.ts`; tested by `src/lib/__tests__/notification-email-render.test.ts`. Change layout and copy only, never triggers, recipients or sending.

### C3. Finish
Every marketing page ends with ClosingBand and SiteFooter (except `/pilot`, `/contact` and candidate pages). When every marketing page uses the new layout, delete `src/styles/run-transition.css` and its import in `src/styles.css`, delete unused components, and report what was removed.

### C4. Tracking events
Through the existing tracking module (`src/lib/tracking/`), consent-aware, no new vendors: `role_typed` (exists), `chapter_seen`, `industry_found`, `role_card_opened`, `package_selected`, `pilot_form_started`, `pilot_requested`. No `call_booked` (there is no booking).

### C5. Checks before each phase goes live
- Every price, day count and channel count matches `offer.ts`.
- One h1; headings descend in order; no heading inside a decorative demo.
- One primary button label per page, saying what happens.
- No sideways scroll at 390, 768, 1024 and 1440 wide.
- Every control reachable by keyboard with the visible blue focus ring.
- Text contrast at least 4.5 to 1.
- Reduced motion shows the final frame; nothing loops. The page reads correctly with the canvas off.
- Points add up to scores; funnel totals add up to "reached"; quotes match their source text.
- Example data labelled once per screen in the same words everywhere.
- No emoji, dark section, card shadow, all-caps label or second typeface.
- The built page contains no prompt text, builder comments or internal notes.
