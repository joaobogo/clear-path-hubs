# Final audit, 8 October 2026

Scope: the owner's five requests this session, the full scheduling and booking removal, the re-check of the 66-item website audit, the three review rounds, test evidence and open decisions.

Basis: every status below comes from reading the current working tree (393 changed paths in `git status`, uncommitted; 380 files in `git diff HEAD --stat`, +1202 / -18214 lines). Nothing is committed. Where a fact comes from the main agent's session and was not re-observed in this audit, the line says so.

## Executive summary

1. All five requests are Done in code and covered by unit tests; the main agent reports a real-browser Playwright check confirmed them (not re-run here).
2. Booking and scheduling are removed end to end: 73 files deleted, public `/book`, `/book-call`, `/book-a-call`, `/schedule`, `/demo` answer 301 to `/contact`, and the three scheduler endpoints answer 200 and do nothing.
3. No migration and no database change was made (`git status supabase` is empty; `src/integrations/supabase/types.ts` untouched).
4. Feedback and scorecards now key on the candidate match; the first submission creates one lightweight completed `interviews` row.
5. Owner must act: run the read-only legacy-interview query, message people with a future `scheduled` interview, then run the reviewed close script (default ROLLBACK) by hand.
6. The 66-item website audit re-checks to 46 Done, 7 Done (needs owner fact), 10 Not done, 3 Unverified; four evidence cells in the older README were stale and are corrected below (H18, H20, M4, M7 line).
7. Review rounds 1 and 2 raised 6 high or medium dashboard findings (one low), 3 medium regression findings and several low ones; all were fixed except items accepted below. Round 3 result is pending.
8. `npm run typecheck` is clean; `npx vitest run`: 2266 passed, 2 failed (the two Supabase-environment tests that already failed before any change).
9. Still open: Calendly sub-processor row in `/privacy`, the Calendly webhook stub, CRM list name "Book a call", old CTA wording in docs, the owner-decisions register (A to F), prettier lint noise.
10. Not verified here: production behaviour, the `/jobs` 500 on a connected environment, the build run, and the Playwright run (reported, not re-observed).

---

## A. The owner's five requests

### A1. Take out calendar and booking: client and candidate talk off system

| Item | Detail |
| --- | --- |
| Status | Done |
| Root cause | The product ran its own scheduler (slots, availability, Calendly, ICS, reminders) across public, client, candidate and admin surfaces. The owner wants the two sides to arrange interviews directly. |
| Public | `LEGACY_BOOKING_PATHS` (`/book`, `/book-call`, `/book-a-call`, `/schedule`, `/demo`) in `src/config/booking.ts:11-17`; 301 for GET/HEAD and 308 otherwise via `legacyBookingMiddleware` in `src/start.ts:53-68`, rule in `src/lib/seo/edge-policy.ts`. |
| CTAs | `CTA_MESSAGE` = "Send us a message" to `/contact` (`src/config/cta.ts:30-33`); used in `src/content/pricing.ts:28,120`. Intake end-of-flow now goes to `/intake/confirmation` instead of `/book` (`src/routes/intake.tsx:2082`); intake links read "Prefer to talk first? Send us a message." (`intake.tsx:3891`, `:4133`). |
| Client | "Request interview" is "Move to interview stage"; it records the stage and decision only. `/client/interviews` is a record of past interviews plus a feedback list (`src/components/client/interview-history-list.tsx`, `src/lib/interview-feedback-queue.ts`). |
| Candidate | No pick-a-time, confirm or availability preference. A future legacy interview shows read-only under "Your interview" (`src/lib/candidate/legacy-interview.ts`, `src/lib/candidate.functions.ts:352`, `src/routes/_authenticated/me.applications.$id.tsx:391`). |
| Admin | Calendly webhook panel, interview-exceptions panel, `admin.interviews` page, "Interviews to coordinate" tile and "Interview slots" SLA commitment removed (`src/lib/admin-ops.server.ts`, `src/lib/admin-sla-breach.*`). |
| Endpoints | `booking.reminders.ts:26`, `candidate/interview-reminders.ts:26`, `booking/calendly-webhook.ts` return `{"ok":true,"disabled":true,"reason":"scheduling removed"}`; the `.ics` route is deleted. |
| Database | No change. Feedback and scorecards key on the match: `ensureCompletedInterviewForMatch` in `src/lib/interview-record.server.ts` inserts the row as scheduled, then completes it (the lifecycle trigger forbids inserting "completed"). |
| Verified by | `src/lib/__tests__/interview-feedback-queue.test.ts` (queue lists matches at interview stage with no feedback; drops covered ones; `planInterviewRecord` creates once, is idempotent, completes legacy rows rather than adding a second, prefers a completed row); `src/lib/__tests__/legacy-interview.test.ts`; `src/lib/__tests__/interview-activity.test.ts`; `src/components/client/__tests__/interview-history-list.test.tsx` ("no scheduling controls", "only Feedback on a completed row"); `src/lib/seo/__tests__/edge-policy.test.ts` ("redirects every retired booking path to /contact"); `tests/unit/stage-counts-read-the-lane.test.ts` and `tests/unit/notification-names-its-subject.test.ts` (updated). Playwright real-browser check: reported by the main agent, not re-run here. |

### A2. Intake: "job title" and "team" from step 1 not parsed into step 2

| Item | Detail |
| --- | --- |
| Status | Done |
| Root cause | The description was read only after the client reached step 2, and a failed read left both fields empty with no sign. |
| What changed | New `src/lib/jd-title-guess.ts` (`guessTitleAndTeam`; since folded into `src/lib/jd-quick-read.ts`, 9 Oct): a deterministic read of labelled lines ("Job title:", "Team:", "Department:") or a title-shaped first line; never guesses from prose. In `src/routes/intake.tsx` the effect now runs on steps 1 and 2 (`:1482` `if (stepIndex > 1) return`), applies the guess at once (`:1485`) and then the model read. `guessedRef` (`:1366`) lets the model result replace a guess, but never a value the client typed (`applyBlueprint`, `:1381`). |
| Verified by | `src/lib/__tests__/jd-quick-read.test.ts` (formerly `jd-title-guess.test.ts`): "reads labelled lines", "reads a title-shaped first line and a department line", "does not turn company boilerplate or a sentence into a title", "never invents a team from prose", "handles empty input". The replace-guess logic lives inside the component and has no unit test of its own; it was covered by the browser check (reported). |

### A3. "Ideal start date": remove "We will tell you honestly…"

| Item | Detail |
| --- | --- |
| Status | Done |
| Root cause | A hint on two fields promised an honesty judgement the product does not give. |
| What changed | Hint removed from the start-date field and trimmed on Timeline to `Between ${MIN_TARGET_DAYS_TO_OFFER} and ${MAX_TARGET_DAYS_TO_OFFER} days.` (`src/routes/intake.tsx:3416`). `grep "tell you honestly"` in `src` finds only an unrelated sentence on `/integrations` (`src/routes/integrations.tsx:320`). |
| Verified by | `git diff` shows both removals; browser check reported. No dedicated unit test. |

### A4. "Confirming the job description": text clipped to 400 characters

| Item | Detail |
| --- | --- |
| Status | Done |
| Root cause | `src/lib/intake-review.ts` built the row with `.slice(0, 400)`. |
| What changed | The row now carries the whole description; when a file was uploaded the filename leads and the read text follows (`intake-review.ts` around `:173-182`). Related low fix in the same file: review row label "First name" is now "Name" (`:124`). |
| Verified by | `src/lib/__tests__/intake-review.test.ts`, "shows the whole job description, not a clipped preview" (text over 400 characters, asserts length greater than 400). |

### A5. "What we read": website domain cut short ("co-kreator.c")

| Item | Detail |
| --- | --- |
| Status | Done |
| Root cause | The domain was derived on every keystroke from the email, and the old guard ("only while empty") froze the first partial value, so "co-kreator.c" stayed after the client finished "co-kreator.com". |
| What changed | (a) `companyWebsiteFromEmail` (`src/lib/express-intake-schema.ts:75`) now requires a real last label: two or more letters, or a punycode `xn--` TLD. (b) `src/routes/intake.tsx:1336-1360`: `derivedWebsiteRef` remembers what the effect derived, only overwrites its own value, and repairs a saved draft whose value is a strict prefix of the derived domain (`staleDerivedPrefix`). |
| Verified by | `src/lib/__tests__/intake-step-shape.test.ts`: "derives the company domain", "refuses a free-mail domain", "never derives a half-typed domain while the address is still being typed" (covers `co-kreator`, `co-kreator.`, `co-kreator.c`, punycode), "refuses anything that is not an address". The draft-repair branch is in the component and has no unit test. Browser check reported. |

---

## B. Inventory of the removal

### B1. Deleted files (73, from `git diff HEAD --name-status | grep '^D'`)

| Area | Files |
| --- | --- |
| Public booking | `src/routes/book.tsx`, `src/routes/_authenticated/book-call.tsx`, `src/routes/api/public/booking.$sessionId.ics.ts`, `src/components/marketing/book-a-call.tsx`, `src/components/marketing/booking-cta-router.tsx`, `src/components/booking/{calendly-inline,kickoff-booking-card,scheduler-panel}.tsx`, `src/config/calendly.ts`, `src/config/scheduler.ts`, `tests/e2e/book.spec.ts` |
| Booking and scheduling server | `src/lib/booking/` (booking-events, booking-schema, booking.functions, booking.server, calendly-webhooks.functions and .server, kickoff.functions, native-scheduling.server, outlook.server, scheduling-settings.server, slots, plus `__tests__/cohost-attendees` and `quick-booking-role`), `src/lib/booking.functions.ts`, `src/lib/scheduling.ts`, `src/lib/scheduling.functions.ts` |
| Client | `src/components/client/interviews/` (awaiting-confirmation, confirm-form, detail-row, helpers, interview-detail-dialog, propose-form, request-interview-dialog), `src/components/client/scheduling/` (availability-manager, interview-timeline, slot-proposer), `src/lib/client/` (interview-buckets, interview-holder, interviews-to-confirm and its `.server`, tests `interview-holder`, `interview-state-agreement`) |
| Candidate | `src/components/candidate/` (availability-block, interview-attend-block, interview-change-controls, interview-response-card), `src/lib/candidate/` (availability-preference, interview-attend, interview-change, interview-reminders.server, interview-slots), `src/lib/availability.ts`, `src/lib/availability.functions.ts`, tests `availability*`, `interview-attend`, `interview-change`, `tests/candidate/interview-response.test.ts` |
| Admin | `src/components/admin/calendly-webhook-panel.tsx`, `interview-exceptions-panel.tsx`, `src/routes/_authenticated/admin.interviews.tsx`, `src/lib/interview-exceptions.ts`, `.functions.ts`, `.server.ts` |
| Shared | `src/lib/interview-events.server.ts`, `interview-proposal.ts` and its test, `interview-state.ts` and its test, `interview-timing.ts` and `tests/unit/interview-timing.test.ts`, `src/lib/email-templates/interview-reminder.tsx` |

### B2. Endpoints neutralised (kept registered, do nothing)

| Route | Behaviour now |
| --- | --- |
| `/api/public/booking/calendly-webhook` (POST) | 200 `{"ok":true,"disabled":true,"reason":"scheduling removed"}`; reads, verifies, stores and sends nothing (`calendly-webhook.ts`) |
| `/api/public/booking/reminders` (`booking.reminders.ts:26`) | Same JSON; was 63 lines, now a stub |
| `/api/public/candidate/interview-reminders` (`:26`) | Same JSON |
| `/api/public/qa-seed` | 59 lines of scheduling seed removed |
| Retired page URLs | 301 to `/contact` (see A1) |

### B3. Deliberately kept for stored data

| Kept | Where | Why |
| --- | --- | --- |
| Event names `interview_requested`, `interview_scheduled`, `interview_rescheduled` | `src/lib/events.ts`, `notification-tiers.ts`, `control-room-shared.ts`, `notifications-resolver.server.ts` | Existing notification and event rows still carry them; the resolver closes stale ones. |
| Database enums and columns (interview statuses, `calendly_event_uri`, `calendly_invitee_uri`) | `src/integrations/supabase/types.ts` (untouched) | No schema change was made. |
| Legacy labels (for example `discovery_call` lead type "Discovery call booking") | `src/config/lead-notifications.ts:18,33,44,55` | Stored lead rows use the value. |
| CRM list "Book a call" (`book-a-call`, type `consultation`) | `src/lib/crm/attio-config.ts:44-48` | External Attio list name; not renamed. |
| Calendly LLC sub-processor row | `src/content/pages/privacy.json` section 6 | Counsel decision (register A8). |
| Calendly webhook route stub | `src/routes/api/public/booking/calendly-webhook.ts` | Lets an external subscription stop retrying. |
| Read-only legacy interview note | `src/lib/candidate/legacy-interview.ts` | Future `scheduled` rows still show to the candidate. |

### B4. Behaviour changes users will notice

| Who | Change |
| --- | --- |
| Visitors | Booking links land on `/contact`; buttons say "Send us a message"; copy promises a reply within one business day (`RESPONSE_TIME`, `src/config/offer-facts.ts:78`). |
| Clients | No availability, propose times, confirm, cancel or reschedule. "Interviews" figures count candidates who reached the interview stage plus older interview records, once per candidate, and are no longer labelled "held". Feedback is allowed for any candidate at the interview stage. "Book a call" links in the workspace are gone. |
| Candidates | No pick-a-time or availability preference. Application page: "The employer will contact you directly to arrange the interview." |
| Staff | Four admin panels and one SLA commitment gone; admins now get `candidate_stage_changed` for interview-stage moves (`src/lib/client-decisions.functions.ts:271,656`). |
| Email | No interview reminder email template or reminder sends. |

### B5. Deploy and cutover (from `docs/ops/scheduling-removal-cutover.md`)

| Step | When | Who |
| --- | --- | --- |
| Run the section 2 read-only query (open `requested`, `scheduling`, and future `scheduled` interviews) and save the result | Before deploy | Owner |
| Send the one-off messages (section 4) to clients and candidates with a future `scheduled` interview | Before deploy | Owner |
| Confirm the external scheduler calling the reminder endpoints uses the cron secret (it keeps getting 200) and nobody relies on the Calendly webhook | Before deploy | Owner |
| Deploy the code | - | Owner |
| Smoke test: move a test candidate to the interview stage; submit feedback twice; confirm one completed `interviews` row; check a future legacy interview shows "Your interview" | After deploy | Owner |
| Run the section 3 close script with `rollback;`, read `rows_to_cancel` and `still_open` (expect 0), then re-run with `commit;`. It cancels `requested` and `scheduling` rows, resolves stale `interview_requested`/`interview_rescheduled` notifications, and leaves future `scheduled` rows alone unless a marked line is uncommented | After deploy | Owner, by hand |
| Re-run section 2; only future `scheduled` appointments should remain | After deploy | Owner |

**No migration and no database change was made.** `git status supabase` shows nothing and no `.sql` file is in the diff. The only SQL is inside the cutover note, and it has not been run. The owner must run it.

---

## C. Re-verified status of the 66-item website audit

Method: each ID re-checked against the current tree. Rows marked `*` were re-grepped in this audit; unmarked rows were carried from `docs/seo-cro/README.md` (last updated 7 October) after spot-checking neighbouring facts, not re-grepped individually. "Done" means code and copy changed; nothing was checked on production.

Totals after this audit: 46 Done, 7 Done needing owner fact, 10 Not done, 3 Unverified (same as the README; only evidence cells changed).

Changes versus the README: H8 and M10 reword for the booking removal; C5 notes the page is gone; H18 and H20 evidence corrected (the SSO claim and the "Brogger" spelling are already gone from `src`); M4 evidence corrected (one remaining mismatch); M7 line numbers refreshed.

### C. Critical

| ID | Status | Evidence |
| --- | --- | --- |
| C1 | Not done | CDN purge needs provider access; code side is the cache headers in `src/lib/seo/edge-policy.ts` (register F1) |
| C2 * | Done | `PRICE_PILOT_USD = 699` (`src/config/pricing-core.ts:31`); no `$399` string in `src` outside blog salary text |
| C3 * | Done | Retired plans absent from routes; `Bronze` only in comments (`src/components/client/plan-panel.tsx:272`, `src/lib/plans.functions.ts:110`, `src/lib/hire-handoff.ts:44`); `/trust` redirects to `/security` (`legacy-redirects.ts:28`) |
| C4 | Done | `pricing-tier-card.tsx`; `src/routes/__tests__/pricing-page-claims.test.ts` |
| C5 * | Done (page since removed) | No `INSTRUÇÃO` or `MVP readiness` in `src`; `/book` now 301 to `/contact` |
| C6 * | Done (needs owner fact) | `src/config/case-study-metrics.ts` requires provenance, none recorded, none render (register B3) |
| C7 * | Done | No "Named outcomes" in `src/routes/about.tsx` |
| C8 * | Done | No `100% credential` in `src` |
| C9 * | Done (needs owner fact) | No `900M`; integrations marked `planned` (`integrations-directory.ts:14`); actual channels Unknown |
| C10 * | Done (needs owner fact) | `FIRST_SHORTLIST_TIMING` (`offer-facts.ts:42`), 5 business days, not a guarantee (register C1) |
| C11 | Done | Pilot copy in `src/routes/pilot.tsx` and `pricing-core.ts` |
| C12 * | Done (needs owner fact) | Placeholders absent; `legal@taasflow.com` at `src/config/trust-center.ts:24` (register A1) |

### H. High

| ID | Status | Evidence |
| --- | --- | --- |
| H1 * | Done | `WHO_RUNS_THE_SEARCH` (`offer-facts.ts:26`) |
| H2 | Done (needs owner fact) | Claim removed; recruiters unnamed (register B1). No `20+ senior` string left in `src` outside a test |
| H3 * | Done | No `20,000+` in `src` outside a copy-facts test (register B4) |
| H4 * | Done | `/case-studies` title "Example Engagements | TaaSFlow" (`case-studies.tsx:39`) |
| H5 * | Done | `badge = "Example dashboard"` (`src/routes/enterprise.tsx:827`) |
| H6 | Done | Cross-sell only in `src/config/ecosystem.ts` |
| H7 * | Done | Pilot card `CTA_PRIMARY` to `/pilot`; paid cards `CTA_MESSAGE` (`src/content/pricing.ts:104-121`). No `CTA_BOOK` anywhere in `src` |
| H8 * | Done, then superseded | Booking removed. Secondary action is "Send us a message" to `/contact` (`src/config/cta.ts:30`); five retired booking URLs 301 to `/contact` |
| H9 * | Done | `/system` to `/how-it-works#scoring` (`legacy-redirects.ts:25`) |
| H10 * | Done | `ROSTER_COUNTS` (`agent-roster.ts:280`) |
| H11 * | Done | `CHANNEL_AGENT_COUNT` derived (`channel-agents.ts:58`) |
| H12 * | Done | `INTAKE_STEPS.length` and `INTAKE_TOTAL_MINUTES` (`how-it-works.tsx:49`). Internal label "Open the 5-step intake wizard." remains at `src/config/business-rules.ts:302` |
| H13 * | Done | `SEATS_NOTE` (`offer-facts.ts:93`); no "Invite as many" in `src` |
| H14 | Done | `pricing-entitlements.ts`; `pricing-ladder-is-whole.test.ts` |
| H15 * | Not done (owner and counsel) | `PRICING_GUARANTEES` has only "No hidden fees" and "No placement fee" (`src/content/pricing.ts:218-221`) (register A5) |
| H16 * | Done | `RECORDS_NOTE` (`offer-facts.ts:89`) |
| H17 | Not done (partly) | Payment copy only when `PAYMENTS_ENABLED` (false, `commerce.ts:10`); account creation still in step 1 (register D1). Intake wording changed this session to "Create your workspace" / "We agree the plan with you" (no booking step) |
| H18 * | Done (needs owner fact) | Corrected: Enterprise governance cell is now "Included + security review" (`pricing-entitlements.ts:~178`); no `SSO` string left in the entitlements or trust config. `src/routes/faq.tsx:160` asks "Do you support SSO…" and answers without claiming it. Whether SSO or MFA exist is Unknown (register A3) |
| H19 * | Done | `ATS_NOTE` (`offer-facts.ts:101`) |
| H20 * | Done (needs owner fact) | Corrected: no `Brogger` string remains anywhere in `src` (the README said `about.json` still had it). Leadership list and spelling still need owner confirmation (register B2) |
| H21 | Done | Native `<details>` in `src/routes/faq.tsx` (7 occurrences); production check pending |
| H22 | Not done (partly) | Redirects and noindex in place; authors, dates and sources unchanged (register E1-E3) |
| H23 | Unverified | Database rows, not code (register D4) |
| H24 * | Done | `src/routes/ai-in-hiring.tsx`, `src/config/ai-in-hiring.ts` exist (register A6) |

### M. Medium

| ID | Status | Evidence |
| --- | --- | --- |
| M1 | Done (emoji only in admin; cross-page score consistency Unverified) | `src/components/unicorn-marker.tsx` |
| M2 * | Done | H1 `Flat-fee recruiting. ${PRICE_PILOT_DISPLAY} for your first role.` (`pricing.tsx:100`) |
| M3 | Done | `public: false` filter, guarded by a test in `marketing-copy-facts.test.ts` |
| M4 * | Not done (partly) | Candidate CV is PDF only in the apply flow (`jobs.$id.apply.tsx:391-394,1393,1416`), the agent registry (`registry.ts:65`) and the roster (`agent-roster.ts:65`, guarded by `marketing-copy-facts.test.ts:39-44`). One mismatch remains: `src/components/marketing/platform-architecture.tsx:112` says "Parsed CV text (PDF, DOCX, TXT or RTF)", rendered on `/how-it-works` (`how-it-works.tsx:258`) |
| M5 | Done | `PROCESS_STEPS` in `offer-facts.ts` |
| M6 * | Done | `RESPONSE_TIME = "within one business day"` (`offer-facts.ts:78`); no "same business day" |
| M7 * | Done | Hidden, `aria-hidden` honeypots: `src/routes/contact.tsx:507`, `src/routes/intake.tsx:3766` (`companyFax`, `tabIndex={-1}`), `src/components/marketing/employer-inquiry-form.tsx:276` |
| M8 | Unverified | Not checked in rendered HTML |
| M9 | Unverified | Not checked in rendered HTML |
| M10 * | Done (superseded) | The call no longer exists; `CALL_NAME`/`CALL_MINUTES` absent. Copy: `RESPONSE_TIME_SENTENCE` (`offer-facts.ts:79`), `INQUIRY_FOLLOWUP_SENTENCE` (`:82`). Stale public-adjacent text: `src/content/pages/enterprise.json` still says "30-minute strategy session with our founding team" (see F) |
| M11 * | Done | "Series A–C operators" label gone; a blurb at `src/lib/marketing/industry-relationships.ts:35` still says "Series A–C teams" |
| M12 | Done | Labelled examples; no A-1042 on `/agents` |
| M13 * | Done | "Sign in" to `/login` (`public-navigation.ts:52,132`) |
| M14 * | Not done | No security@ mailbox; reports go to privacy@ (`trust-center.ts:457-458`) (register A4) |
| M15 | Done | `COMPLIANCE_NOTE` (`offer-facts.ts:107`) |
| M16 * | Done | `saas-workforce-outlook-2026` redirects to `saas-hiring-guide-2026` (`blog-redirects.ts:54`) |
| M17 | Not done | Apollo and marketplace wording unconfirmed (register A9) |
| M18 | Done | String absent |
| M19 * | Not done | `vertical-configuration.ts:203,207` still lists "GMP production" and "(acute, community, GMP, GCP)" |
| M20 * | Done | `/status` uses `noindexMarketingHead` (`status.tsx:38`) |
| M21 | Done | No "by Friday" in public routes |
| M22 * | Not done | `ALWAYS_ON_TRACKERS = ["rb2b"]` (`src/lib/tracking/consent.ts:162`); counsel review not recorded (register A7) |

### L. Low

| ID | Status | Evidence |
| --- | --- | --- |
| L1 | Done | String absent |
| L2 * | Done | H1 "Site map" (`sitemap.tsx:126-128`); intro paragraph still reads "Every page on TaaSFlow, grouped by section" (`:130`); page is noindex |
| L3 * | Done | `/trust` redirect |
| L4 * | Done | `/journey` to `/about#story` (`legacy-redirects.ts:30`) |
| L5 * | Done | Not in `about.tsx`; the G20 sentence remains once each in `src/content/pages/about.json` and `enterprise.json` (not rendered) |
| L6 * | Done | One "Global reach" (`global-talent.tsx:109`); page noindex |
| L7 | Done (two titles in title case) | `src/content/money-pages.ts:504,607` |
| L8 | Not done | Counsel to align (register E6) |

### C-bis. Contradictions list in the README, rechecked

| README item | Now |
| --- | --- |
| 1 Homepage title "Recruiting Subscription & Candidate Sourcing" | Still true (`src/content/pages/index.json`, which changed this session but kept the string) |
| 2 `about.json` / `enterprise.json` subscription-era copy and "Brogger" | "Brogger" gone; subscription-era copy and the G20 sentence remain |
| 3 CV format mismatch | Narrowed to `platform-architecture.tsx:112` (M4) |
| 4 Enterprise row "Included + SSO" | No longer true (H18) |
| 5, 6, 8, 9, 10 | Not re-checked; item 6 is true for "5-step" (`business-rules.ts:302`), "30-minute discovery call" is gone |
| 7 `/privacy` lists Calendly | Still true (register A8) |

### C-ter. Playbook prompts 00 to 23

The playbook text itself is not in the repository, so only prompts that `docs/seo-cro/README.md` maps to a deliverable can be stated. Statuses are the existence of that deliverable, not a judgement of its quality.

| Prompt | Deliverable | Status |
| --- | --- | --- |
| 00 | `00-baseline-and-route-manifest.md` | Written; production revision Unknown (F5) |
| 04 | `01-cta-route-matrix.md` | Written; updated for booking removal (modified in tree) |
| 09 | `02-capability-matrix.md` | Written; owner verification column open |
| 12, 13 | `05-metadata-and-schema-inventory.md` | Written (20 pages) |
| 17, 19 | `03-measurement-plan.md` | Written; `qualified_lead`, `pilot_paid`, `pilot_started` unwired (D5) |
| 21 | `07-offsite-profile-drafts.md` | Drafts only; nothing submitted |
| 22 | `04-cro-test-register.md` | Written; no experiment live |
| 23 | `06-release-checklist.md` | Written; not yet executed on production |
| 01-03, 05-08, 10, 11, 14-16, 18, 20 | No file maps to them | Unverified (not mapped in the repository) |

---

## D. Review log

### Round 1: dashboard integrity review

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| H1 | High | Feedback and scorecards impossible for new interviews (no interview row exists) | Fixed: match-keyed feedback via a lightweight completed interview row (`src/lib/interview-record.server.ts`, `src/lib/interview-feedback-queue.ts`) |
| H2 | High | In-flight legacy interviews invisible | Fixed: cutover SQL (section 2 query) plus read-only "Your interview" note (`legacy-interview.ts`) |
| M1 | Medium | Admins not told of interview-stage moves | Fixed: `candidate_stage_changed` emitted on both paths (`src/lib/client-decisions.functions.ts:271,656`) |
| M2 | Medium | Orphaned legacy `requested` rows | Cutover SQL section 3 (owner runs it) |
| M3 | Medium | Evergreen follow-up tasks | Fixed: stage-aging threshold (file not individually traced in this audit) |
| M4 | Medium | KPI tiles read only interview rows | Fixed: stage-aware counts (`src/lib/kpis/interview-activity.ts`, used in `kpis/interviews.server.ts:16`, `client/week-activity.server.ts:4`) |
| L1 | Low | `cv-consent-gate` `has_interview` | Fixed: stage-history based (`src/lib/consent/cv-consent-gate.ts` `reachedInterview`) |

### Round 1: public crawl and intake browser verification (reported by the main agent)

| Finding | Severity | Resolution |
| --- | --- | --- |
| 219 URLs crawled: no 404, no 5xx, no redirect chains, except `/jobs` returns 500 in the sandbox | Info | Environmental: no Supabase credentials in the sandbox. Owner action: verify `/jobs` on the connected environment. Not verifiable here (the two failing tests below have the same cause) |
| Blog sentence "book a 20-minute call" | Low | Fixed in blog content (the string no longer appears in `src/content/blog`) |
| Review row label "FIRST NAME" | Low | Fixed: "Name" (`src/lib/intake-review.ts:124`) |
| "Hiring a Crew scheduling?" | Low | Fixed: "Hiring for …?" |

### Round 2: fix re-review and regression/security review

| Severity | Finding | Resolution |
| --- | --- | --- |
| Medium | Stage check missing on feedback record creation (any editor could mint a completed interview) | Fixed: `interview-record.server.ts` rejects with `match_not_at_interview_stage` unless the match is at or past the interview stage, or history or an un-reversed request shows it reached it |
| Medium | Future-scheduled legacy row breaks completion (constraint: `completed_at` not before `scheduled_at`) | Fixed: `completed_at = max(now, scheduled_at)` (`interview-record.server.ts:58-72`) |
| Medium | Undone interview request kept CV access | Fixed: `reversedDecisions` in `cv-consent-gate.ts:38-45` and `consent/interview-evidence.server.ts:12,49` |
| Low | Punycode TLD refused by the website rule | Fixed (`express-intake-schema.ts:75`; test covers `xn--p1ai`) |
| Low | Restored draft website reference not tracked | Fixed (`derivedWebsiteRef`, `intake.tsx:1348-1355`) |
| Low | Stale title guess after a replaced description | Fixed (`guessedRef` replace-guess logic) |
| Low | Weekly-update visibility filter | Fixed (`src/lib/client-weekly-update.server.ts`) |
| Accepted | Synthetic completed interview row carries the submit date, not the real interview date | Accepted, known |
| Accepted | KPI windows can count an interview in two weeks | Accepted, known |
| Owner / counsel | Privacy notice still lists Calendly | Counsel decision (register A8) |

### Round 3: narrow review of round-2 fixes

<!-- ROUND3 -->

| Severity | Finding | Resolution |
| :--- | :--- | :--- |
| Medium | The stage guard on creating the lightweight interview record ignored undone interview requests, so a request that was undone could still pass the guard and reopen CV access through the synthetic interview row. | Fixed. One shared helper, `src/lib/consent/interview-evidence.server.ts`, now answers "did this match reach interview?" for both the CV download gate and the feedback guard. Undone requests are accounted for, and interview rows are excluded when the guard itself is creating them. |
| Medium/Low | An admin moving a match to the interview stage with no client decision keeps CV access after a later client decline (wider than the old interview-row rule). | Accepted as intended: interviews are arranged off system, so the stage history is the record. Documented, and a test now pins the behaviour (`cv-consent-gate.test.ts`). |
| Low | A fresh job description could cause two model reads (a guessed title changed the re-read signature). | Fixed. The signature only includes a title the client typed. The guard test in `jd-blueprint.test.ts` was updated to match. |
| Low | Timestamp comparison mixed string formats. | Fixed with `Date.parse`. |
| Low | `guessedRef` is updated inside a state updater, which would misbehave under React StrictMode. | Accepted: StrictMode is not used anywhere in `src`. Revisit if it is ever enabled. |
| Low | The feedback form shows a generic error for `match_not_at_interview_stage`. | Accepted: safe, polish only. |

Round 3 found no critical or high issues. Round-3 verification: typecheck clean; full test run 2,267 passed and 2 failed, the same two Supabase-environment tests as before any change.

---

## E. Test and build evidence

| Check | Result | Source |
| --- | --- | --- |
| `npm run typecheck` | Clean (no output after the tsc line) | Run in this audit |
| `npx vitest run` | 2266 passed, 2 failed, 8 skipped; 268 files passed, 2 failed, 1 skipped | Run in this audit (30.7 s) |
| The 2 failures | `src/lib/__tests__/message-history-log.test.ts` and `src/lib/__tests__/messaging-history.test.ts`: "Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY". They failed on the original branch before any change (reported by the main agent; not re-run on the original branch here). Cause is visible in the error: no credentials in the sandbox |
| `npm run build` with all prebuild guards | Passed | Reported by the main agent; deliberately not run in this audit |
| Playwright, real browser | The five requests confirmed | Reported by the main agent; not re-run here |
| Round 1 crawl | 219 URLs | Reported by the main agent |
| New or changed tests for this work | `jd-quick-read` (was `jd-title-guess`), `interview-feedback-queue`, `interview-activity`, `legacy-interview`, `interview-history-list`, `intake-review` (full description), `intake-step-shape` (partial domains), `edge-policy` (booking redirects), `stage-counts-read-the-lane`, `notification-names-its-subject` | Present in the tree |

Browser checks reported by the main agent: intake step 1 to 2 carries job title and team; start-date and Timeline hints; confirm screen shows the full description; "What we read" shows the full domain (including a typed `co-kreator.com`); retired booking URLs redirect to `/contact`; CTA labels; the Round 1 public crawl. I could not confirm the exact list of pages the browser run visited.

---

## F. Open items and owner decisions

### F1. New this session

| # | Item | Why it matters | Where |
| --- | --- | --- | --- |
| N1 | Run the cutover SQL (query, then close script with ROLLBACK, then COMMIT) | Legacy `requested`/`scheduling` rows stay open and show stale notifications until closed | `docs/ops/scheduling-removal-cutover.md` sections 2 and 3 |
| N2 | Contact people with a future `scheduled` legacy interview | Their appointment is now off system | Cutover section 4 |
| N3 | Calendly sub-processor wording in `/privacy` (section 6) and `/security` | Booking is gone but the notice names Calendly LLC for "client discovery calls" | `src/content/pages/privacy.json` (register A8) |
| N4 | Keep or delete the Calendly webhook stub | Harmless 200 responder; deleting it makes a live Calendly subscription fail and retry | `src/routes/api/public/booking/calendly-webhook.ts` |
| N5 | Legacy interview data | Calendly columns and old rows remain in the database; retention decision is the owner's | `interviews` table |
| N6 | Rename the CRM list "Book a call" | Left unchanged because it is an external Attio list | `src/lib/crm/attio-config.ts:44-48` |
| N7 | Docs still use the old CTA wording | `docs/cta-inventory.md` (lines 15, 53, 63, 72, 73), plus mentions in `docs/tone-of-voice.md`, `docs/mvp-ledger.md`, `docs/qa/route-four-states-audit.md`, `docs/audit/prompt-45-crawl.md`, `docs/industries/*`, `docs/design/*`, `docs/migration/*.json` | Docs only; not edited |
| N8 | Stale marketing content | `src/content/pages/enterprise.json` ("30-minute strategy session with our founding team"); `discovery_call` label "Discovery call booking" in `src/config/lead-notifications.ts:33` | Decide whether to reword |
| N9 | Lint noise (prettier) not addressed | Not part of this work | repo-wide |
| N10 | Verify `/jobs` on the connected environment | Returned 500 in the sandbox for lack of Supabase credentials | Production or preview |
| N11 | New README mismatch | M4: `platform-architecture.tsx:112` still lists DOCX/TXT/RTF for CVs | Small copy fix |

### F2. Carried from `docs/seo-cro/08-owner-decisions-register.md` (all decision cells are blank in the register)

| Group | Items |
| --- | --- |
| A. Legal, trust | A1 legal entity; A2 DPO statement; A3 SSO and MFA; A4 security@ mailbox; A5 guarantee, refund, replacement terms; A6 bias-testing facts; A7 RB2B consent (counsel); A8 Calendly in privacy and the webhook; A9 Apollo wording |
| B. People, proof | B1 recruiter profiles; B2 leadership and spelling; B3 case-study metric sources; B4 source for "20,000+"; B5 real sample shortlist; B6 client permissions; B7 customer references |
| C. Offer | C1 5-business-day shortlist timing; C2 agency fee benchmark; C3 competitor pricing; C4 pilot rule enforcement; C5 pricing finality; C6 payments stay off |
| D. Product | D1 intake account creation order; D2 WhatsApp number; D3 Portuguese and LGPD; D4 seeded job listings; D5 qualified-lead definition; D6 open job pages indexable; D7 `/mvp-fix-plan` and `/dev/*` on production |
| E. Content | E1 26 noindexed blog posts; E2 13 consolidation candidates; E3 authors, dates, sources; E4 homepage title and stale JSON; E5 healthcare and HIPAA wording; E6 staffing partnership wording |
| F. Operations | F1 CDN purge; F2 Search Console access; F3 analytics exports; F4 preview host list; F5 production deployed revision |

Register note: A8 in the register describes the Calendly webhook route and stored booking data; it is consistent with the current tree. The register does not mention the CRM list name or the `discovery_call` lead label (N6, N8).

### F3. Where the owner must act (short list)

1. Cutover SQL and the two outbound messages (N1, N2), before and just after deploy.
2. Counsel and owner decisions on the privacy notice (N3, A7, A1).
3. Confirm `/jobs` and a smoke test of the interview-stage and feedback path on the connected environment (N10).
4. Decide on the Calendly webhook stub and legacy data (N4, N5).

---

## Things not verified in this audit

| Item | Why |
| --- | --- |
| Production or preview behaviour of any page, redirect or endpoint | Only the working tree was read |
| `npm run build` and prebuild guards | Instructed not to run; result is the main agent's report |
| Playwright run, 219-URL crawl, `/jobs` 500 cause | Reported by the main agent; not re-observed |
| The two failing tests failing on the original branch | Reported; the error text is consistent with it but the original branch was not tested |
| File and line of the Round 1 M3 (follow-up task) fix | Not traced |
| Round 3 | Pending (placeholder above) |
| Playbook prompts 01-03, 05-08, 10, 11, 14-16, 18, 20 | The prompt text is not in the repository |
| README rows not marked `*` in section C | Carried from the 7 October README, not individually re-grepped |
