# Lovable prompts: finishing The Run (phases 4, 5 and 6)

## How to use this file
1. Paste one prompt at a time, in order. Each block between the lines is one message.
2. Wait for Lovable's report. Check the page it asks you to look at, on your phone and on a computer, before pasting the next prompt. If something looks wrong, tell Lovable what is wrong and do not move on.
3. Every prompt points Lovable at two files in the repository, so the rules and the spec are the same every time:
   - `docs/handoff/lovable-house-rules.md`: what must never break, the design rules, the checks to run, the report format.
   - `docs/handoff/run-spec-phases-4-6.md`: the redesign document's specification for these phases.
4. Run the inputs prompt first (`docs/handoff/lovable-prompt-redesign-inputs.md`). Several prompts below use what it produces.
5. If a report shows any red check other than the two known database tests, reply "Fix the failing checks before anything else, then report again."
6. Things only you can supply are marked OWNER. Lovable leaves those parts hidden until you provide them.

---

## Prompt 0. Baseline (no changes)

```
Read docs/handoff/lovable-house-rules.md and docs/handoff/run-spec-phases-4-6.md in full, and docs/audit/2026-10-10-redesign-progress.md for what has already been built.

Do not change any file in this task.

1. Run every check in section 5 of the house rules and report the results verbatim.
2. List the marketing routes in src/routes that still render the old layout (they sit inside SiteShell but do not use the new components in section 4.8 of the house rules). One line each.
3. List the workspace routes under src/routes/_authenticated, grouped as client, admin and candidate (me).
4. Confirm you understand these five rules by restating each in one sentence: no database or migration changes; no client interview or offer actions; no booking; no typed prices or counts; example data always labelled.

Report and stop.
```

---

## Phase 4. Industry pages

### Prompt 4.1. The nine model files and 57 industry files (data only)

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections A1 to A4.

Data only. Do not touch any page, route or component in this task.

1. Create src/config/models/ with nine JSON files, one per model in A1, using exactly the weights, raised list and "what decides" sentence in the table. Write "intake" (four items) and "controls" (three items) for each model from what the live industry pages already say for industries on that model (src/content/industries-v2.ts, src/content/industries-batch2.ts, src/content/industry-config.ts, src/content/industry-archetypes.ts).
2. Create src/config/industries/ with 57 JSON files, one per slug in A2, in the shape in A4. Fill every field from the existing content for that slug. Rules:
   - "model" from the A2 table. "group" from FAMILY_LABEL via INDUSTRY_ARCHETYPE in src/content/industry-archetypes.ts.
   - "headline" follows the pattern "[Industry] hiring, calibrated per [what differs]." Keep it under 70 characters.
   - "families" and roles: only what the existing entry says for this industry. A role with no requirements written gets only a title. Never copy a role card from another industry.
   - "checks": four, from the existing challenges, rewritten as what is captured at intake.
   - "priorities": five; the first with "strong" and "watch" written in full, from the existing candidate signals.
   - "questions": five, from the existing FAQs, in their existing words.
   - "blueprint": include it ONLY if the existing page has a blueprint whose role belongs to this industry's own families. If the inputs prompt created src/config/run-industries/, use those blueprints for hospitality, healthcare and logistics and then delete that folder. Otherwise leave "blueprint" out.
   - "indexable": true only for hospitality and healthcare (today's INDEXABLE_INDUSTRY_SLUGS). Everything else false.
   - "photo": only if a photo already exists for this slug in src/content/industry-hero-images.ts or public/images/run/. Otherwise leave it out.
   - Never put a price, a day count, a seat count or a channel count in these files.
3. Create src/config/industries/index.ts that imports all model and industry files with types, and exports getModel(key), getIndustry(slug), allIndustries(), industriesOnModel(key) and neighbours(slug) (three on the same model, then the nearest industry on another model by weight distance).
4. Add tests in src/config/industries/__tests__/: every model's weights total 100; every industry names an existing model; all 57 slugs from A2 exist and match the existing routes; no industry file contains "$", "business day", "channels" or a digit followed by "%"; a blueprint's role appears in that industry's families; no role-card sentence (required, scored, ask) appears in two industries; checks has four entries and priorities five; questions has five.
5. Do not delete or edit src/content/industries-v2.ts or industries-batch2.ts. The live pages keep reading them until the template replaces them.

Report per the house rules, plus: the list of industries without a blueprint, and any field you could not fill from existing content.
```

### Prompt 4.2. The rubric and industry components (no pages yet)

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections A5, A6 and A10.

Build these components, reading only from src/config/industries/index.ts and src/config/offer.ts:
1. src/components/signature/rubric-signature.tsx: seven segments in the fixed order, widths proportional to weights, raised segments in --blue-600 and the rest in --blue-300, a 1 px white gap between segments, height 8 px. It has a visually hidden text list of the seven weights for screen readers. Sizes: "card" (full width) and "inline" (120 px).
2. src/components/signature/rubric-card.tsx: on paper (.paper), the model name ("Shift-led, one of nine hiring models"), the signature, then the seven weights as a list with "raised" beside the raised ones, then the model's "why" sentence.
3. src/components/data/industry-card.tsx: name, one line on what is scored, the inline signature, the model name, the number of role families. No icon, no image. Whole card is one link.
4. src/components/data/role-card.tsx: three columns (usually required, what we score, what we will ask about). A column with nothing written is not drawn. On a phone the columns stack.
5. src/components/data/blueprint-doc.tsx: a document on paper: role, must-haves, dealbreakers in --alert-ink with a coral rule, two screening questions. Props allow a "Start from this blueprint" link to /intake?role=<role>.
Add all five to the existing developer catalogue page (src/routes/dev.catalogue.tsx) with hospitality, healthcare and one stack-led industry as examples. Add unit tests for the signature (segment widths sum to the container, order is fixed) and the role card (empty columns are not rendered).

Show me /dev/catalogue at 390 and 1440 wide. Report and stop.
```

### Prompt 4.3. The template, on hospitality only

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections A5 and A8.

1. Build src/components/industry/industry-template.tsx with the eight blocks in A5, in that order, on those surfaces, reading only from src/config/industries/index.ts, src/config/offer.ts and the existing shared components. A block whose data is missing is not rendered at all (no heading, no empty box).
2. Block 1: the ConvergenceField with seed = industry name. On desktop the surviving lines end on the seven rubric lines of the RubricCard (pass their positions through getTargets, as src/components/home/run-hero.tsx does for the list rows). Below 1024 px wide do NOT draw the field behind the headline or text: either confine it to the band around the rubric card with getFrame, or leave it out. The headline must be readable before any canvas loads.
3. Block 6: reuse the run row from src/components/home/chapters/chapter-proof.tsx (extract it into a shared component without changing how the homepage looks). Label: "A representative engagement for this sector". Link to the matching case study.
4. Block 7: emit FAQ structured data from the five questions, using the existing structured-data helpers in src/lib/marketing/head.ts. Emit breadcrumb structured data. No price markup.
5. Head: title "[Industry] recruiting on a flat fee | TaaSFlow", description from "settings". Keep the existing robots logic (src/lib/seo/indexability.ts).
6. Wire ONLY /industries/hospitality to the new template, in src/routes/industries.$slug.tsx. Every other slug keeps the current page untouched. The briefing route (industries_.$slug.briefing.tsx) is untouched.
7. Track role_card_opened when a role card opens and role_typed from the hero input, through src/lib/tracking.
8. Tests: hospitality renders one h1, eight or fewer h2 in A5 order, the pilot price equals offer.pilot.price, and no text from another industry's file appears.

Show me /industries/hospitality at 390 and 1440 wide, with reduced motion on and off. Report the eight checks in A8 for hospitality, each ticked or not with a reason. Stop.
```

### Prompt 4.4. Healthcare and logistics

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections A3 to A8.

Wire /industries/healthcare and /industries/logistics to the industry template. Change nothing in the template's layout: only data differs between the three pages.
- Healthcare keeps its plain boundary statement (that TaaSFlow does not verify licences with issuing bodies and holds no HIPAA certification) as a single paragraph under block 3, from the existing entry's "boundary" field.
- Logistics: the live page shows a maintenance engineer blueprint, which belongs to another industry. If src/config/industries/logistics.json has no blueprint of its own, block 5 stays hidden. Do not invent one.
- Logistics stays "indexable": false until all eight A8 checks pass.

Show me both pages at 390 and 1440 wide, and a three-column table of hospitality, healthcare and logistics with: model, raised weights, role in the input, headline, has its own blueprint, indexable. Report the A8 checks for each. Stop.
```

### Prompt 4.5. The rest of the lead tier

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections A3 to A8.

Wire these five pages to the industry template: food-beverage, travel, retail, manufacturing, construction. Data only; no layout changes.
For each page, if a field is thin in the existing content, leave it empty so its block hides. Do not pad with generic text.
Set "indexable": true only for a page that passes all eight A8 checks, and add it to the indexable list through the industry file (make src/lib/seo/indexability.ts read "indexable" from the industry files, keeping its exported names and its tests passing).

Report a table of the eight lead pages against the eight checks. Show me retail and construction at 390 wide. Stop.
```

### Prompt 4.6. The remaining 49 pages, from data

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections A3 to A8.

1. Wire every remaining industry slug to the industry template. All stay "indexable": false (noindex, follow) unless they pass all eight checks.
2. Fix as you go: no builder prompt text anywhere (search for "INSTRUÇÃO", "TEXTO DO USUÁRIO", "MVP readiness" in src and in the build output); no blueprint from another industry; no role card repeated from a neighbour; no price or day count typed anywhere.
3. When no route renders the old industry page component (src/components/marketing/industry-page.tsx and anything only it uses), delete it and say which files were removed. Keep src/content/industries-v2.ts and industries-batch2.ts if anything else still imports them (blog, sitemap, briefing); otherwise report that they can be removed and do not remove them.
4. Make sure the industry sitemap (src/routes/sitemap-industries[.]xml.ts) lists only indexable pages, and its tests pass.

Report: a table of all 57 slugs with model, blueprint yes or no, indexable yes or no, and which of the eight checks fail. Show me three random non-lead pages at 390 wide. Stop.
```

### Prompt 4.7. The industries hub

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section A6.

Rebuild /industries (src/routes/industries.index.tsx) from the industry files:
1. h1, supporting line and "Find my industry" button as in A6. The "57" in the supporting line is the number of industry files, not typed.
2. The RoleInput is the search. As the visitor types, suggest matching roles from every industry file's families (role title, its family, its industry) and matching industry names. Choosing a role goes to that industry page with ?role=<role> so its hero input is filled. Track industry_found.
3. The nine models panel: each model with its signature and its count of industries; selecting one filters the cards. The six group chips with counts, Consumer & Service first.
4. IndustryCards in a grid: one column on a phone, two at 768, three at 1280.
5. Keep the existing search parameters working (existing links and bookmarks into /industries with filters must still land somewhere sensible).
6. /industries/non-profit (src/routes/industries.non-profit.tsx) keeps working; if it duplicates /industries/nonprofit, keep it as a redirect, not a second page.
7. ClosingBand and SiteFooter at the bottom.

Test: typing any role title listed in any industry file finds its industry. Show me /industries at 390 and 1440 wide. Stop.
```

### Prompt 4.8. Role pages (OWNER: one recruiter-written blueprint per role)

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section A7.

1. Add the route /industries/<slug>/<role> rendering a role page ONLY when src/config/roles/<slug>--<role>.json exists. Any other role slug returns the normal not-found page. The segment "briefing" is reserved for the existing briefing route and must keep working.
2. Role file shape: { "industry": slug, "slug", "title", "scoredOn": [three things], "must": [], "dealbreakers": [], "questions": [], "writtenBy": "recruiter initials", "approved": true }. A role file with "approved" not true is ignored.
3. Layout as A7: left the blueprint in three ruled columns and the five days on the RunClock; right, sticky on desktop and after the blueprint on a phone, the blue order card with the role filled in and "Start from this blueprint" to /intake?role=<title>, then a three-row preview of what arrives (labelled representative).
4. On the industry page, a role chip links to its role page only when the role file exists.
5. Add role pages to the sitemap only when the industry is indexable and the role is approved.
6. Do not create any role file yourself. If src/config/roles/ is empty, build the route and the template, add one example file named src/config/roles/__example.json that is never routed, and stop.

Show me one role page if any approved role file exists. Report and stop.
```

### Prompt 4.9. Share cards

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section A9.

1. Write scripts/share-cards/render.mjs that renders a 1200 by 630 HTML card per industry file and per page type (home, pricing, pilot, results, agents, platform, how a role runs) with the existing Playwright dependency, and writes PNGs to public/share/<name>.png. Card: wordmark and "Hiring, handled.", the headline, the rubric card (industries only), the field drawn from the name with src/lib/run/field.ts. White ground, tokens only, Archivo, no icon. Text at least 40 px so it reads on a phone.
2. Add "share:cards": "node scripts/share-cards/render.mjs" to package.json scripts. Do not add any package.
3. Point each page's og:image to its card through the existing head helper (src/lib/marketing/head.ts), falling back to /og-image.png when the PNG is missing.
4. If your environment cannot run a browser, commit the script and the head wiring, say so, and stop: the owner will run "npm run share:cards" once.

Show me three of the PNGs. Report and stop.
```

---

## Phase 5. Workspace

Do these with a seeded test account, never on real client data. Every prompt in this phase is presentation only.

### Prompt 5.1. The shell

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections B1, B2 and B4.

Restyle src/components/workspace/workspace-shell.tsx as B2: 232 px white rail, wordmark, one blue "Run a new role" button to the existing new-role route for clients (keep the admin and candidate rails' existing primary action if they have one), the destinations, account, the signed-in person; current item on --blue-50; collapses to icons below 1280; top bar 60 px with breadcrumb left and search right; content on --paper with 24 px padding.
Keep every navigation item, permission check, org switcher, global search, notification bell, collapse state and mobile drawer exactly as they work today. Do not rename or remove any item.
Apply the workspace density in B1 through the shell's own CSS variables, not by editing every page.

Show me the client Overview, an admin page and a candidate (me) page at 390 and 1440 wide, before and after. Report and stop.
```

### Prompt 5.2. Overview

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections B3 (Overview) and B4.

Rebuild the presentation of src/routes/_authenticated/client.index.tsx with the data it already loads:
1. "Needs you today": at most three decision cards from the existing decision queue (src/lib/client-decision-queue.ts). One button each, only the first blue. An ink border only when the card comes from a released (signed) shortlist.
2. Roles table: stage as four segments, run clock as "Day n, hh:mm" from the approved brief, the four funnel numbers in the order reached, matched, scored, signed (only those the data has; never fill a missing one), evidence coverage, next step in words. On a phone each role is a card, never a sideways-scrolling table.
3. Agent log on .tint, newest first, with three counts above, from whatever activity data the page already has. If there is none, hide the panel.
4. Empty state: "No roles running. Type a job title to start one." with the RoleInput (onRun opens the existing new-role flow with the title).
Done when a client with one released shortlist reaches it in one click from login.

Show me Overview with roles and empty, at 390 and 1440 wide. Report and stop.
```

### Prompt 5.3. Role page

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections B3 (Role) and B4.

Restyle src/routes/_authenticated/client.positions.$id.tsx with its existing data and actions:
1. Header: role title, four facts as chips (include the locked rubric version if the data has it), run clock, the Seal only when the shortlist has been released, with the releasing recruiter's name and time if the data has them.
2. Lifecycle bar of the nine stages, mapped from the existing stage values: done blue, the stage waiting on a person ink. If a stage has no equivalent in the data, show it greyed, never invented.
3. The ConvergenceField seeded by the role title with this role's own four counts (real numbers only; if a count is missing, do not draw the field). On a phone keep it away from text, as on the homepage.
4. Top 10: rank, candidate, EvidenceStrip, score, source. Decisions as chips: waiting in outline, shortlisted in blue.
5. Right column: reach by channel as blue bars only if per-channel data exists and totals "reached"; the rubric with weights, read-only.
Do not change any action, query or mutation.

Show me one role at 390 and 1440 wide. Report and stop.
```

### Prompt 5.4. Candidate page (the evidence lens)

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections B3 (Candidate) and B4.

Restyle src/routes/_authenticated/client.candidates.$id.tsx with its existing data:
1. Left: the CV as text. Every sentence quoted as evidence is outlined in --blue-600. Right: requirements in rubric order, each with quote, status and points. Selecting a requirement scrolls to and highlights its sentence.
2. A recruiter-confirmed requirement carries an ink dot. The recruiter's note closes the list beside the Seal, only if the shortlist was released.
3. Decisions: the existing DecisionBar (src/components/client/decision-bar.tsx), restyled only: "Shortlist this candidate" is the one blue button, "Decline for this role" is an outline, the existing undo and its timing stay exactly as they are. Do NOT add "Accept for interview" or any interview or offer action.
4. If points do not add up to the header score or a quote cannot be found in the CV text, show the existing data as it is and list the mismatch in your report. Do not adjust numbers.
On a phone: requirements first, CV text below, the decision bar fixed at the bottom with safe-area padding.

Show me one candidate at 390 and 1440 wide. Report and stop.
```

### Prompt 5.5. Compare

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections B3 (Compare) and B4.

If the candidates list (src/routes/_authenticated/client.candidates.index.tsx) already has a compare view, restyle it as B3. If it has none, add a read-only compare view reached by selecting two to four candidates on that list (state in the URL), using only data already loaded for those candidates.
Grid: requirements down the side with weights, candidates across, each cell the strip segment, the quote or the gap, and the points. Strongest evidence per requirement on --blue-50; ties not shaded; a conflict inside one CV in coral. Under each column, the existing decision actions only.
On a phone: one candidate per swipe-free stacked section, requirements in the same order, never a sideways-scrolling grid.

Show me a three-candidate compare at 390 and 1440 wide. Report and stop.
```

### Prompt 5.6. Billing

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections B3 (Billing) and B4.

Restyle src/routes/_authenticated/client.plan.tsx:
1. The Receipt (src/components/signature/receipt.tsx) for the client's current package from its existing plan data, marked paid only if the data says paid, with the $0.00 lines.
2. Usage: positions used as segments of the package size, seats, access end date, and the existing terms sentence about drafts.
3. The PackageSelector, showing package totals from offer.ts only. Never a per-position figure.
4. No payment action of any kind. "Talk to us about more roles" goes to /contact. PAYMENTS_ENABLED stays false.
Every figure comes from the client's data or offer.ts.

Show me Billing at 390 and 1440 wide. Report and stop.
```

### Prompt 5.7. Recruiter sign-off (OWNER: recruiter names come from their accounts)

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections B3 (Recruiter sign-off) and B4.

Find the screen where an admin releases a shortlist to a client today (src/routes/_authenticated/admin.publish.tsx and the review and approvals screens). Restyle it as the sign-off screen:
1. The proposed finalists: strip, score, quotes checked, the recruiter's one-line note (existing field), opened or not.
2. Four checks with ink ticks: every finalist opened, every finalist has a note, every score has evidence, the rubric is locked. "Opened" may be tracked in the page's own state for this session if the data does not record it; say which you did.
3. The sign button is ink, the only ink button in the product, disabled until all four checks pass. It calls the EXISTING release action, unchanged. After release, show the Seal with the signed-in recruiter's display name and the time.
4. "What the agents flagged" on .tint, from existing flags; hidden if there are none.
5. Do not change the release gate, its permissions, which database client it uses, or the client_visible / released_at logic. No shortlist may reach a client by any other path than it does today.

Show me the screen before and after release, using the test account only. Report and stop.
```

### Prompt 5.8. Candidate portal

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections B2 and B3 (Candidate portal).

Restyle the /me pages (src/routes/_authenticated/me.*.tsx) in the shell: My applications, Open roles (link to /jobs), Profile, CV, Messages, Privacy, Settings. On an application, show the candidate's own EvidenceStrip and the questions they will be asked only if that data is already available to them today; never expose scores or notes that are not visible to them now.
Keep every upload, edit, privacy and deletion action exactly as it works.

Show me My applications and one application at 390 wide. Report and stop.
```

### Prompt 5.9. Workspace sweep

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections B1 and B4, and C5.

With the test accounts, open every workspace route (client, admin, me) at 390 and 1440 wide and fix only presentation problems: sideways scroll, overlapping text, tap targets under 44 px, contrast under 4.5 to 1, missing focus ring, old colours or fonts, card shadows, all-caps labels. Do not change data, actions or permissions.
Confirm by search that no client screen contains "Accept for interview", "Approve an interview slot", "Make an offer" or a booking or calendar control.

Report a table of every route with pass or the fix made. Stop.
```

---

## Phase 6. The rest

### Prompt 6.1. How a role runs

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section C1.

Rebuild /how-it-works (src/routes/how-it-works.tsx) with the existing components only: headline and supporting line from C1; the four moves (Brief, Broadcast, Score, Sign-off) on one clock using RUN_CHAPTERS from src/config/run-chapters.ts and the RunClock; for each move what happens, who does it (agents or a person) and what the client sees. Reuse the homepage chapter components where they fit rather than drawing new ones. Keep every fact already on the live page that is still true; remove anything that contradicts offer.ts. ClosingBand and SiteFooter at the end.

Show me the page at 390 and 1440 wide. Report and stop.
```

### Prompt 6.2. Platform, then the header link

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section C1.

1. Rebuild /platform (src/routes/platform.tsx) on the new system: the eight modules and nine stages already on the live page, each in plain words; the EvidenceStrip, Seal and Receipt where they show a module; LogLine-style agent activity on .tint labelled representative. No new claims.
2. Then change the header's fifth link from "Agents" to "Platform" in src/config/public-navigation.ts and update its test. Agents stays in the footer.

Show me /platform at 390 and 1440 wide and the header on a phone. Report and stop.
```

### Prompt 6.3. Agents

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section C1.

Rebuild /agents (src/routes/agents.tsx): the roster from src/config/agent-roster.ts and the limits already on the live page; agent and channel counts from offer.ts (26 and 23); the seven channels named in CHANNELS_NAMED_IN_PUBLIC and the rest by family from CHANNEL_FAMILIES; the Seal to show where a person signs. Do not publish query logic, targeting rules, message templates, vendor names or per-channel yield.

Show me the page at 390 and 1440 wide. Report and stop.
```

### Prompt 6.4. Enterprise

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section C1.

Rebuild /enterprise (src/routes/enterprise.tsx): no Bronze, Silver or Gold table and no second price list anywhere on the page; link to /pricing for packages; 100+ positions scoped with the account team; the existing security and procurement facts, linking to /trust and /security; "Send us a message" to /contact as the action. No booking.

Show me the page at 390 and 1440 wide. Report and stop.
```

### Prompt 6.5. Results and six case studies

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section C1.

1. Rebuild /case-studies (src/routes/case-studies.tsx): h1 "Six runs, day by day.", the publishable proof figures only through offer.proof (none render until the owner records their sources), then six run rows on one day axis (the shared run row from prompt 4.3), each labelled with EXAMPLE_ENGAGEMENT_LABEL and linking to its case study.
2. Add /case-studies/<slug> for each entry in src/content/case-studies.ts with a CaseStudy template: situation, roles, the run row, how it ran day by day, what the client received. No performance figures. Labelled once with EXAMPLE_ENGAGEMENT_LABEL. Add these pages to the sitemap as noindex until a named client approves one.
3. Industry pages' block 6 links to the matching case study.

Show me /case-studies and one case study at 390 wide. Report and stop.
```

### Prompt 6.6. About

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section C1.

Rebuild /about (src/routes/about.tsx) on the new system. Keep the two founders exactly as they are: names, titles, photos, quotes, bios, tags, the employer disclaimer and the LinkedIn rule in the file's comments. Keep the four principles in their existing words. No new people, no generated photos, no new claims.

Show me the page at 390 and 1440 wide. Report and stop.
```

### Prompt 6.7. Candidate pages

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section C1.

Rebuild the presentation of /jobs, /jobs/<id>, /jobs/<id>/apply, /talent-network, /candidate-join and /candidate-success: headline "Open roles, and what each one is scored on.", supporting line "You see the requirements before you apply.", the search as the input with "Search roles". On a job, show its requirements before the apply button. These pages have no ClosingBand (they are for candidates, not buyers).
The application form, its validation, file upload, consent and submission stay exactly as they are. Do not submit a test application to the live pipeline.

Show me /jobs and one job at 390 wide. Report and stop.
```

### Prompt 6.8. Guides and articles

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section C1.

Restyle the article layout used by /resources/<slug>, /blog/<slug> and their index and category pages: one 680 px column, Archivo, headings on the type scale, tables and figures on tokens, author and date in .narrow, no card shadows, no all-caps. Content untouched. ClosingBand and SiteFooter at the end.

Show me one guide and one blog post at 390 wide. Report and stop.
```

### Prompt 6.9. Every remaining marketing page

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, sections C1 and C3.

Take the list of marketing routes still on the old layout from your prompt 0 report (refresh it first). Move them to the new system in batches of five, committing after each batch with the checks green. Content stays; only layout, type and colour change. Do not touch internal pages (dev.*, mvp-fix-plan, pitch, system, admin) beyond making sure they keep rendering.
Not found (src/routes/notFound.tsx): "This page is not running." / "The address may have changed. Your role can still run." / the RoleInput with "Run this role".

After the last batch, report the full list with done or why not. Show me five of them at 390 wide. Stop.
```

### Prompt 6.10. The three emails

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section C2.

Restyle three emails: brief approved, shortlist signed, weekly summary (src/lib/notifications/subject-body.ts, src/lib/digest/weekly-digest.server.ts and whichever renderer produces the brief-approved email). Each: a small static field image (/run-field.png), one sentence, the four funnel numbers when the data has them (the first three blue, the last ink), one blue button to the existing workspace link. Subject states the fact, for example "Your top 10 for Registered nurse is signed." Inline styles only, tokens as hex at render time from one constants file, Archivo with system fallbacks, 600 px wide, readable in dark mode.
Do not change when emails send, who receives them, the sender, unsubscribe handling or delivery tracking. Do not send any email.
Update src/lib/__tests__/notification-email-render.test.ts for the new copy.

Show me the three rendered HTML emails. Report and stop.
```

### Prompt 6.11. Tracking events

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section C4.

Add the events in C4 that do not exist yet, through the existing tracking module and consent rules in src/lib/tracking, with the same naming and payload style as the existing events. No new vendor, no new script. chapter_seen fires once per chapter per visit when half of it is on screen. Add tests in the style of src/lib/tracking/__tests__.

Report the events, where each fires and its payload. Stop.
```

### Prompt 6.12. Remove the old layer

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section C3.

1. Confirm by search that no marketing page depends on src/styles/run-transition.css (the .site-run transition rules). If any page still does, stop and list it.
2. Delete src/styles/run-transition.css and its import in src/styles.css.
3. Find components with no remaining imports (excluding tests and the dev catalogue) and delete them. List every file removed.
4. Open every public route at 390 and 1440 wide and compare with before: nothing should change visually. If anything changes, restore the file and report.

Report and stop.
```

### Prompt 6.13. Final audit

```
Read docs/handoff/lovable-house-rules.md and follow it. Spec: docs/handoff/run-spec-phases-4-6.md, section C5.

Do not change anything in this task unless a check fails; if one fails, fix only that, then rerun everything.
1. Every public route at 390, 768, 1024 and 1440 wide: no sideways scroll, one h1, one primary button label, every number from offer.ts, no emoji, no dark section, no card shadow, no all-caps label, one typeface, focus ring visible, contrast at least 4.5 to 1, reduced motion shows the final frame.
2. The eight A8 checks for each of the 57 industry pages.
3. Every workspace route at 390 and 1440 wide with the test accounts: no errors, no sideways scroll, no client interview or offer actions, no booking.
4. Search the built output for "$399", "7 business days", "10 business days", "Bronze", "INSTRUÇÃO", "TEXTO DO USUÁRIO", "MVP readiness", "Book a call": none may appear.
5. Every check in section 5 of the house rules.

Report a table per section with pass or the fix made, and anything left for the owner. Stop.
```
