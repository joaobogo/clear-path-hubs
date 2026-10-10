# House rules for every Lovable change (The Run redesign)

Read this file in full before every task. If a task in a prompt conflicts with a rule here, the rule wins: stop and tell the owner instead of working around it.

## 1. Never break the platform
1. Presentation only, unless the prompt says otherwise. Do not change Supabase tables, migrations, RLS policies, edge functions, server functions' auth or data logic, cron jobs, environment variables or secrets.
2. Never add or edit a file under `supabase/`. Never run a migration. Never write to the live database. Never submit test forms, test candidates or fake records to the live pipeline.
3. Server functions that approve or override roles use the authenticated caller's database client, not the privileged client, so the database checks platform-admin permissions itself. Do not change which client they use.
4. Keep every existing route, URL, redirect and query parameter working. A page that is rebuilt keeps its path. Never delete a route unless the prompt names it.
5. Keep every existing user action working exactly as it works now (shortlist, decline, undo, messages, uploads, sign in, intake drafts, the pilot form). Restyling a button never changes what it calls.
6. Do not upgrade, add or remove npm packages unless the prompt names the package.
7. Do not force-push, rebase, amend or squash. Small commits, each leaving the site working.

## 2. What the product must not do
1. Clients get no interview or offer actions. Never build "Accept for interview", "Approve an interview slot", offer buttons or interview scheduling for clients. Existing client decisions stay as they are: "Shortlist this candidate" and "Decline for this role", with the existing undo.
2. No booking or scheduling anywhere: no "Book a call", no calendar, no slot picker. The quiet alternative is "Send us a message" linking to `/contact`.
3. `PAYMENTS_ENABLED` stays false. No checkout button, no card form, no payment link.
4. Never show a price per position, per hire or per role anywhere public. Package totals only.

## 3. Facts versus examples
1. Every price, day count, seat count, candidate count, channel count (23) and agent count (26) is read from `src/config/offer.ts`. Never type one of these numbers into a page, a JSON file or a component.
2. Proof figures publish only through `publishableMetrics()` in `src/config/case-study-metrics.ts`. Never write a provenance line yourself.
3. Example data (candidates, CV lines, scores, recruiter notes, funnel counts, channel reach, runs, case-study scenarios, blueprints you draft) must be labelled once per screen with the existing label: `REPRESENTATIVE_LABEL` from `src/lib/previews/representative-fixtures.ts`, or `EXAMPLE_ENGAGEMENT_LABEL` from `src/content/case-studies.ts`.
4. Never name a client, a recruiter or a person who is not already named in the repository with approval. Never generate a photograph of a real person.
5. Never write your instructions, notes, status updates or these rules into page text, code comments shown to users, alt text or meta tags.

## 4. Design system (no exceptions)
1. Colours, spacing, radii and type only from `src/styles/tokens.css`: `--ink`, `--slate`, `--faint`, `--rule`, `--rule-2`, `--paper`, `--white`, `--blue-50` to `--blue-800`, `--alert`, `--alert-ink`, `--alert-wash`, and the surface classes `.day` (white, default), `.tint` (pale blue, agents are working), `.blue` (solid blue band where something goes out). No hex values, no new colours, no gradients.
2. In Tailwind arbitrary values for custom properties, write `text-[color:var(--ink)]` and `bg-[color:var(--blue-50)]`, not `text-[var(--ink)]`.
3. Archivo is the only font. Type helpers: `.wide` (headings), `.narrow` (small labels), `.num` (figures), `.display` (the one big headline).
4. Blue means work, ink means a person signed, coral (`--alert`) means attention. Ink buttons exist in one place only: the recruiter's sign-off button.
5. The only shadow is the `.paper` class. No card shadows, no hover lift, no fade-in on scroll, no icons in tinted circles, no pill badges above headings, no emoji, no all-caps labels, no dark sections. Sentence case everywhere.
6. One h1 per page. Headings descend in order. One primary button label per page.
7. Button labels on the marketing site: "Start a $699 pilot" (header and closing band, price from `offer.ts` via `CTA_PRIMARY` in `src/config/cta.ts`), "Run this role" (wherever the role input appears), "Start from this blueprint" (industry and role pages), "Request my $699 pilot" (pilot form only), "Send us a message" (quiet alternative).
8. Reuse what exists before building anything: `src/components/system/` (RunButton, RoleInput, WeightSlider, PackageSelector), `src/components/signature/` (ConvergenceField, RunClock, EvidenceStrip, Seal, Receipt), `src/components/layout/` (SiteHeader, SiteFooter, ClosingBand, ChapterRail, BrandMark), `src/components/marketing/site-shell.tsx`, `src/lib/run/field.ts`, `src/lib/run/rubric.ts`. If a component the prompt needs does not exist, build it in the folder the spec names and say so in the report.
9. Phones first. Every page must work at 390 px wide with no sideways scroll, tap targets at least 44 px, and text readable on plain white (decorative drawings never sit behind body text on a phone).
10. Motion respects reduced motion: the finished frame, nothing loops.

## 5. Before every commit
Run all of these and paste the result lines in your report. Fix anything red first.
```
npm run typecheck
npm test
npm run check:vocabulary
npm run check:kpi-sync
npm run check:scaled-content
npm run check:internal-links
npm run build
```
Two tests are known to fail without a database: `message-history-log.test.ts` and `messaging-history.test.ts`. Any other failure is yours to fix. Never skip, delete or weaken a test to get green.

Then search the source you changed for: `\$[0-9]`, `business days`, `channels`, `INSTRUÇÃO`, `TEXTO DO USUÁRIO`, `MVP readiness`. Numbers must come from `offer.ts`; the three phrases must not exist.

## 6. Report after every prompt
1. Files changed, one line each on what changed.
2. Components used on each changed page (anything outside the list above stands out).
3. The check output above, pass or fail, verbatim.
4. What you left out and why, and anything you were unsure about.
5. One thing you would do differently.
Stop after the report. Do not start the next prompt.
