# STABILIZATION.md — MVP inventory and verification ledger
Mode: inventory + observation only. No fixes, no redesign, no new features in this pass.
Crawl method: Playwright, dev server at localhost:8080, viewport 1280x1800, QA personas (platform_admin / client_admin / candidate) seeded via the token-guarded QA seed route. Console captured per page (`error` + `pageerror`).

## Totals

- Total routes inventoried in this pass: **39** (of 163 route files in the repo)
- Total interactive elements catalogued: **943**, all marked `[ ] UNVERIFIED`
- BROKEN items: **7** (BLOCKER 6, HIGH 0, LOW 1)

## BROKEN list (sorted by severity)

| Severity | Location | Symptom |
|---|---|---|
| BLOCKER | `/me` | Candidate portal renders only the marketing shell (h1 "Welcome to TaaSFlow", 394 chars, no applications/profile/messages UI); the only interactive elements present are the cookie-notice buttons. |
| BLOCKER | `/me/applications` | Candidate portal renders only the marketing shell (h1 "Welcome to TaaSFlow", 394 chars, no applications/profile/messages UI); the only interactive elements present are the cookie-notice buttons. |
| BLOCKER | `/me/profile` | Candidate portal renders only the marketing shell (h1 "Welcome to TaaSFlow", 394 chars, no applications/profile/messages UI); the only interactive elements present are the cookie-notice buttons. |
| BLOCKER | `/me/cv` | Candidate portal renders only the marketing shell (h1 "Welcome to TaaSFlow", 394 chars, no applications/profile/messages UI); the only interactive elements present are the cookie-notice buttons. |
| BLOCKER | `/me/messages` | Candidate portal renders only the marketing shell (h1 "Welcome to TaaSFlow", 394 chars, no applications/profile/messages UI); the only interactive elements present are the cookie-notice buttons. |
| BLOCKER | `/me/settings` | Candidate portal renders only the marketing shell (h1 "Welcome to TaaSFlow", 394 chars, no applications/profile/messages UI); the only interactive elements present are the cookie-notice buttons. |
| LOW | `all routes` | Third-party Apollo intent pixel returns HTTP 400 (`aplo-evnt.com/api/v1/intent_pixel/track_request`) on every page load; external vendor call, no app impact. |

## Console error sweep summary

- Public (8 routes): no app-origin errors. Only the Apollo pixel 400.
- Admin (15 routes): no app-origin errors after hydration completes.
- Client (10 routes): no app-origin errors; `/client/team`, `/client/settings`, `/client/plan` show a second Apollo pixel 400 only.
- Candidate (6 routes): no console errors, but no portal content either — see BLOCKER rows.
- Note: at 2.5s after `domcontentloaded` every authenticated route was still empty; content appeared only after waiting for a heading (up to ~30s in dev). Slow hydration is recorded here as an observation, not a fix.

## Public routes

### `/`
- rendered heading: `Your Talent
Management Solution` | text length: 27499 | interactive elements found: 61
- element mix: button×44, tab×12, input×5
  - [ ] UNVERIFIED — button: "Platform" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Alex R. TOP FIT Senior Product Designer · 8 yrs · B2B SaaS L" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Priya M. STRONG FIT Senior Product Designer · 7 yrs · Fintec" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Dan K. CONSIDER Senior Product Designer · 9 yrs · Marketplac" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "View CV" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Design systems ownership STRONG" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "B2B SaaS product experience STRONG" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Team leadership STRONG" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Design ops tooling VALIDATE" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Shortlist" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Interview" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Pass" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Queue" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Compare" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "01 Role Blueprint" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "02 Search Strategy" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "03 Candidate Sourcing" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "04 Evidence Review" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "05 Candidate Ranking" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "06 Workspace Delivery" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "07 Client Decision" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "08 Feedback Loop" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Overview" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Positions" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Candidates" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Candidate detail" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Comparison" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Collaboration" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Founders Hire without building a talent team." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "HR & Talent Teams Add sourcing capacity your team can trust." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Enterprise Coordinate hiring at portfolio scale." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Staffing Agencies White-label sourcing capacity." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "What if the first shortlist is wrong?" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Do we have to switch our ATS?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "What happens if we cancel?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How is this different from an AI sourcing tool?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Is our data used to train models?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Cookie preferences" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Queue" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Compare" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Overview" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Positions" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Candidates" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Candidate detail" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Comparison" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Collaboration" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Founders Hire without building a talent team." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "HR & Talent Teams Add sourcing capacity your team can trust." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Enterprise Coordinate hiring at portfolio scale." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Staffing Agencies White-label sourcing capacity." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "5" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "20" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "85000" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "40" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "25" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/jobs`
- rendered heading: `Open roles` | text length: 3095 | interactive elements found: 16
- element mix: button×12, input×2, dropdown×2
  - [ ] UNVERIFIED — button: "Dismiss announcement" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Platform" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Work model" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Employment type" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "All levels" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Junior to Mid-Level" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Senior" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Cookie preferences" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Search roles" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Location" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Work model" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Employment type" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/intake`
- rendered heading: `Launch a role in minutes.` | text length: 1544 | interactive elements found: 25
- element mix: button×14, input×11
  - [ ] UNVERIFIED — button: "Email me a link back to this" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "1. You and your company" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "2. The role" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "3. Details and confirm Optional now" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Continue with Google" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show password" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Create my account now" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "I already have an account" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Back" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Continue" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Northwind Health" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "northwindhealth.com" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "linkedin.com/company/northwind" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "(unnamed)" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Head of Talent" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "linkedin.com/in/yourname" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/login`
- rendered heading: `Sign in to TaaSFlow` | text length: 589 | interactive elements found: 12
- element mix: button×9, input×2, form×1
  - [ ] UNVERIFIED — button: "Continue with Google" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show password" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Sign in" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Forgot password?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Didn't get your confirmation email?" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "(unnamed)" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — form: "Email Password Sign in Forgot password? Didn't get your conf" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/pricing`
- rendered heading: `One platform, Talent Management that scales.` | text length: 18328 | interactive elements found: 29
- element mix: button×20, tab×4, input×5
  - [ ] UNVERIFIED — button: "Dismiss announcement" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Platform" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "One-Off Package" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Subscription" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "See all 6 capabilities" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "See all 7 capabilities" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "See all 8 capabilities" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Queue" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Compare" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Cookie preferences" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "One-Off Package" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Subscription" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Queue" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Compare" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "5" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "20" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "85000" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "40" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "25" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/how-it-works`
- rendered heading: `The operational anatomy of a TaaSFlow hire.` | text length: 10797 | interactive elements found: 14
- element mix: button×10, input×4
  - [ ] UNVERIFIED — button: "Dismiss announcement" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Platform" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "#1 Candidate B-2154 85" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "#2 Candidate B-2178 82" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "#3 Candidate B-2201 67" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Cookie preferences" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Weight for Distributed systems" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Weight for Go in production" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Weight for Fintech context" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Weight for Leadership signals" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/contact`
- rendered heading: `Pick your path. We route from there.` | text length: 3271 | interactive elements found: 30
- element mix: button×15, tab×5, input×6, textarea×1, toggle×2, form×1
  - [ ] UNVERIFIED — button: "Dismiss announcement" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Platform" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hire talent Start a role or talk to sales." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Candidate Browse roles or manage your application." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Existing client Reach your account team." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Support Report an issue with your account or workspace." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "General inquiry Press, partnerships, anything else." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "on" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Send message" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Cookie preferences" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Hire talent Start a role or talk to sales." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Candidate Browse roles or manage your application." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Existing client Reach your account team." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Support Report an issue with your account or workspace." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "General inquiry Press, partnerships, anything else." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "(unnamed)" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "e.g. Senior Backend Engineer, Head of Sales" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "on" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — textarea: "A few lines on the role, timeline, and where you are today." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "on" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — form: "Talk to sales Tell us who you are and the role you need to f" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/faq`
- rendered heading: `Straight answers, before you ask.` | text length: 4705 | interactive elements found: 45
- element mix: button×44, input×1
  - [ ] UNVERIFIED — button: "Dismiss announcement" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Platform" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "What is TaaSFlow?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How is TaaSFlow different from an agency?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Who operates the delivery?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Do we need to change our ATS?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Can we start with a single role?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How does TaaSFlow charge?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Are there placement fees?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How is billing handled?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Where can I see pricing?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How are candidates delivered?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How many candidates should we expect?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How fast do candidates start arriving?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Can we request more candidates?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How does TaaSFlow evaluate candidates?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Is the evaluation automated?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "What if we disagree with an assessment?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Can we see the reasoning behind a score?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Who has access to our workspace?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Can multiple teammates review candidates?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "What can we see about progress?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Can we message the delivery team?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Does TaaSFlow support multiple teams or business units?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Do you support SSO and enterprise access controls?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How is reporting handled at scale?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How do we start an enterprise engagement?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Do you work with staffing agencies?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Can delivery be white-labelled?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Who owns the client relationship?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How does a partnership start?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How do I apply for a role?" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "What is the Talent Network?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How do I sign in?" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "What happens after I apply?" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Who can see my candidate profile?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Can I update or delete my data?" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Who has access to client hiring data?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "How can I request more information about privacy?" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Cookie preferences" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Search: pricing, scoring, SSO, referrals…" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

## Admin routes
Post-login landing: `http://localhost:8080/admin`

### `/admin`
- rendered heading: `Work queue` | text length: 5194 | interactive elements found: 26
- element mix: button×25, toggle×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Refresh work queue" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Refresh portfolio health" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Health" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Plan" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "No subs" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Oldest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Subs 7d" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Awaiting client" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Quiet" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Refresh decision backlog" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Nudge" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Log decision" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Thread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/my-day`
- rendered heading: `My day` | text length: 647 | interactive elements found: 11
- element mix: button×10, toggle×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/clients`
- rendered heading: `Clients` | text length: 1800 | interactive elements found: 35
- element mix: button×24, input×2, select×3, dropdown×4, toggle×1, form×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Saved views" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "All statuses" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "All industries" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Last activity" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Apply" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "More actions for Northwind Talent (Demo)" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "More actions for BRPH" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "More actions for neuronflow" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "More actions for Flow Group Ventures" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "More actions for Bob law" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "More actions for atlasflow" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "25" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Prev" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Next" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Search organizations by name" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "on" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — select: "All statuses prospect active paused closed" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — select: "All industries Architecture, Engineering, and Construction (" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — select: "Action required (most) Last activity Last updated (newest) L" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — dropdown: "All statuses" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "All industries" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Last activity" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "25" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — form: "All statuses All statuses prospect active paused closed All " — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/positions`
- rendered heading: `Positions` | text length: 2876 | interactive elements found: 59
- element mix: button×39, tab×2, input×2, dropdown×6, toggle×10
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "All positions" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Needs attention" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show all open roles" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select recruiter" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Preview reassignment" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Grant payment exemption" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Publish" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Saved views" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Filter by client" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Filter by status" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Filter by location" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Sort positions" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select all positions on this page" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Senior Full-Stack Engineer" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Structural Engineer" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Structural Enginer" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Structual Engineer" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Social Media & Design Specialist" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Select Customer Success" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "All positions" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Needs attention" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "e.g. left the company" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Search positions by title" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Select recruiter" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Filter by client" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Filter by status" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Filter by location" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Sort positions" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select all positions on this page" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Senior Full-Stack Engineer" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Structural Engineer" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Structural Enginer" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Structual Engineer" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Social Media & Design Specialist" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Customer Success" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/candidates`
- rendered heading: `Candidate database` | text length: 4062 | interactive elements found: 86
- element mix: button×49, input×3, dropdown×13, toggle×20, form×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Export" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Saved views" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Client" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Job" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Application stage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Screening state" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Approval" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Publication" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Contact release" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Score band" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Evidence confidence" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Critical flags" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Location" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Source" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Rejection reason" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Select all rows on this page" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Candidate" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Score" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Updated" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Select Rui Fernandes" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Miguel Torres" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Tiago Almeida" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Ana Ribeiro" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Pedro Matos" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Sofia Marques" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Inês Lopes" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Carla Nunes" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Diogo Silva" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Beatriz Costa" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Grace Whitfield" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Ryan Castellanos" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Leandro Fonseca" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Alina Moreau" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Tobias Nkemelu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select QA Mobile Tester" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select QA Walkthrough Candidate" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select Sami Ilitja Sheikh" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Prev" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Next" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Search candidates" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Applied from" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Applied until" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Client" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Job" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Application stage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Screening state" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Approval" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Publication" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Contact release" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Score band" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Evidence confidence" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Critical flags" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Location" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Source" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Rejection reason" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select all rows on this page" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Rui Fernandes" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Miguel Torres" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Tiago Almeida" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Ana Ribeiro" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Pedro Matos" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Sofia Marques" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Inês Lopes" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Carla Nunes" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Diogo Silva" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Beatriz Costa" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Grace Whitfield" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Ryan Castellanos" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Leandro Fonseca" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Alina Moreau" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Tobias Nkemelu" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select QA Mobile Tester" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select QA Walkthrough Candidate" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — toggle: "Select Sami Ilitja Sheikh" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — form: "(unnamed)" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/publish`
- rendered heading: `Publish desk` | text length: 3304 | interactive elements found: 26
- element mix: button×24, input×1, toggle×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Grant payment exemption" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Publish" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Needs review 0 Scored candidates awaiting an admin decision." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Blocked 3 Processing failures, provider blocks, and OCR requ" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Ready to publish 0 Approved by admin — one click to send to " — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Published 15 Currently live in the client workspace." — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Held 0 Paused pending clarification." — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Filter this queue" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/health`
- rendered heading: `Pipeline Health` | text length: 7409 | interactive elements found: 22
- element mix: button×21, toggle×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Retry" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Everything" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Bounces" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Complaints" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Unsubscribes" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Suppressed" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Rate limited" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Rejected" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/approvals`
- rendered heading: `Approvals` | text length: 1394 | interactive elements found: 25
- element mix: button×20, input×4, toggle×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Bulk approve" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Refresh" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Approve" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Decline" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Select Structual Engineer" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Select Structural Engineer" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Select Structural Enginer" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/messages`
- rendered heading: `Conversations` | text length: 1270 | interactive elements found: 11
- element mix: button×10, toggle×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/settings`
- rendered heading: `Settings` | text length: 3464 | interactive elements found: 11
- element mix: button×10, toggle×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/team`
- rendered heading: `Team management` | text length: 2216 | interactive elements found: 35
- element mix: button×26, input×4, select×1, dropdown×2, toggle×1, form×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Christian B" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "JOAO KASPRZAK" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Master Admin" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "QA platform_admin" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show all open roles" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Select recruiter" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Preview reassignment" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Platform staff" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Northwind Talent (Demo)" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "BRPH" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "neuronflow" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Flow Group Ventures" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Bob law" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "atlasflow" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Create user" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "e.g. left the company" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "(unnamed)" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Auto-generate if empty" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — select: "Platform admin Operations" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Select recruiter" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — form: "Full name Email Role Platform admin Operations Temporary pas" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/payments`
- rendered heading: `Payments` | text length: 1672 | interactive elements found: 19
- element mix: button×14, tab×4, toggle×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "All" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Paid" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Failed / unpaid" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Refunded" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "All" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Paid" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Failed / unpaid" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Refunded" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/intake`
- rendered heading: `Intake inbox` | text length: 1009 | interactive elements found: 23
- element mix: button×21, input×1, toggle×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Refresh intake aging" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "All open" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "1d+" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "3d+" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "7d+" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Not proceeding (0)" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Pending" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Needs conversion" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Approved" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Rejected" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "All" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Search intake submissions" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/support`
- rendered heading: `Support view` | text length: 2652 | interactive elements found: 34
- element mix: button×31, input×2, toggle×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open read-only" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "24 hours" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "7 days" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "30 days" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Review session actions" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Filter clients" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Support reason" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/admin/notifications`
- rendered heading: `Delivery health` | text length: 1789 | interactive elements found: 17
- element mix: button×16, toggle×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show test records across all admin screens" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open exception digest" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Retry" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Copy payload" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Suppress" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "Show test records across all admin screens" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

## Client routes
Post-login landing: `http://localhost:8080/client?org=0be62883-7c45-47ad-99d1-c654530c531f`

### `/client`
- rendered heading: `Overview` | text length: 2842 | interactive elements found: 25
- element mix: button×22, dropdown×3
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Compact" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Refresh overview" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Detail Show system status detail" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "What you can see" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Steady" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Standard" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Aggressive" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Filter by role" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Filter by agent" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Filter by status" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Show only items that need attention" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Skip tour" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Next" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Close" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Filter by role" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Filter by agent" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Filter by status" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/client/positions`
- rendered heading: `Roles` | text length: 1104 | interactive elements found: 21
- element mix: button×18, input×1, dropdown×2
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Active" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Under review" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Paused" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Archived" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Saved views" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Filter by location" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Sort roles" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Skip tour" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Next" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Close" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Search roles" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Filter by location" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Sort roles" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/client/candidates`
- rendered heading: `Candidates` | text length: 1476 | interactive elements found: 28
- element mix: button×24, input×1, dropdown×3
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "What you can see" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Compare side by side" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Download 0 CVs (ZIP)" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Role" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Stage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Sort" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Unicorn only (95+)" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "More filters" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Remove Awaiting your review" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Clear all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "List" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Board" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Saved views" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Skip tour" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Next" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Close" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Search candidates" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Role" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Stage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Sort" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/client/conversations`
- rendered heading: `Conversations` | text length: 1050 | interactive elements found: 16
- element mix: button×15, input×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "All" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Roles" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Candidates" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Skip tour" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Next" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Close" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Search conversations" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/client/team`
- rendered heading: `QA_TESTCO_E2E` | text length: 2234 | interactive elements found: 28
- element mix: button×21, tab×5, dropdown×2
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Workspace" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Team & roles" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Plan & billing" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Branding" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Invite team member" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Change role for QA platform_admin" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Member actions for QA platform_admin" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Change role for QA client_viewer" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Member actions for QA client_viewer" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Skip tour" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Next" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Close" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Workspace" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Team & roles" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Plan & billing" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Notifications" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Branding" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Change role for QA platform_admin" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "Change role for QA client_viewer" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/client/settings`
- rendered heading: `QA_TESTCO_E2E` | text length: 2653 | interactive elements found: 57
- element mix: button×32, tab×5, input×9, dropdown×1, toggle×9, form×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Workspace" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Team & roles" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Plan & billing" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Branding" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Send confirmation" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Discard" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Save changes" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "on" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Connect channel" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "UTC" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Send reset email" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Sign out of account" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Skip tour" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Next" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Close" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Workspace" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Team & roles" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Plan & billing" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Notifications" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Branding" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "you@company.com" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "QA_TESTCO_E2E" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "https://" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "e.g. Fintech" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "City, Country" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "(unnamed)" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "From the channel's Get link to channel" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "19:...@thread.tacv2" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — input: "Hiring — Engineering" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "UTC" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — toggle: "on" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — form: "New email address Send confirmation" — expected: server call required (mutation/read)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/client/interviews`
- rendered heading: `Interviews` | text length: 1111 | interactive elements found: 14
- element mix: button×14
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Request interview" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Set availability" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Skip tour" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Next" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Close" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/client/offers`
- rendered heading: `Offers & hires` | text length: 1318 | interactive elements found: 11
- element mix: button×11
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Skip tour" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Next" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Close" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/client/approvals`
- rendered heading: `Approvals` | text length: 1111 | interactive elements found: 25
- element mix: button×19, tab×5, dropdown×1
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Export CSV" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "New task" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Assigned to me" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — button: "Team" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Overdue" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Blocking delivery" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Completed" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "All types" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Skip tour" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Next" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Close" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Assigned to me" — expected: server call required (mutation/read)
  - [ ] UNVERIFIED — tab: "Team" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Overdue" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Blocking delivery" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Completed" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — dropdown: "All types" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/client/plan`
- rendered heading: `QA_TESTCO_E2E` | text length: 2487 | interactive elements found: 22
- element mix: button×17, tab×5
  - [ ] UNVERIFIED — button: "Collapse sidebar" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Open global search" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications, none unread" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Account menu" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Workspace" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Team & roles" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Plan & billing" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Notifications" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Branding" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "See options" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Skip tour" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Next" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Close" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Workspace" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Team & roles" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Plan & billing" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Notifications" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — tab: "Branding" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`
  - `error: Failed to load resource: the server responded with a status of 400 ()`

## Candidate routes
Post-login landing: `http://localhost:8080/me`

### `/me` [BROKEN]
- rendered heading: `Welcome to TaaSFlow` | text length: 394 | interactive elements found: 4
- element mix: button×4
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/me/applications` [BROKEN]
- rendered heading: `Welcome to TaaSFlow` | text length: 394 | interactive elements found: 4
- element mix: button×4
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/me/profile` [BROKEN]
- rendered heading: `Welcome to TaaSFlow` | text length: 394 | interactive elements found: 4
- element mix: button×4
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/me/cv` [BROKEN]
- rendered heading: `Welcome to TaaSFlow` | text length: 394 | interactive elements found: 4
- element mix: button×4
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/me/messages` [BROKEN]
- rendered heading: `Welcome to TaaSFlow` | text length: 394 | interactive elements found: 4
- element mix: button×4
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

### `/me/settings` [BROKEN]
- rendered heading: `Welcome to TaaSFlow` | text length: 394 | interactive elements found: 4
- element mix: button×4
  - [ ] UNVERIFIED — button: "Manage" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Decline all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Accept all" — expected: client-side (navigation, view state, filtering)
  - [ ] UNVERIFIED — button: "Hide tracking notice" — expected: client-side (navigation, view state, filtering)
- console:
  - `error: Failed to load resource: the server responded with a status of 400 ()`

---

# Stabilization pass 1 — Authentication (scope: auth only)

Method: Playwright against the dev server, QA personas seeded via the token-guarded QA seed route. Per role: login → landing → mid-session refresh → logout → protected-route retry after logout, with console capture throughout.

## Checklist

| # | Item | Result |
|---|---|---|
| 1a | Admin login lands on own dashboard (`/admin`, h1 "Work queue") | PASS |
| 1b | Client login lands on own dashboard (`/client?org=…`, h1 "Overview") | PASS |
| 1c | Candidate login lands on own dashboard (`/me`, h1 "Hi …, we've got you.") | PASS (was BLOCKER — fixed this pass) |
| 1d | Session survives refresh for all three roles (same URL, same content) | PASS |
| 1e | Logout control reachable for all three roles (Account menu → Sign out) | PASS (was FAIL for candidate — no shell rendered) |
| 1f | Logout clears session (0 `*-auth-token` keys in localStorage) | PASS |
| 1g | Protected route after logout redirects to `/login?redirect=…` | PASS |
| 2 | Signup creates the correct role/records; anonymous applicant is linked to the right candidate record on first sign-in | PASS (fixed this pass) |
| 3a | Wrong credentials show "Email or password is incorrect." — no blank screen, no crash | PASS |
| 3b | Empty fields blocked by field validation, no submit, no crash | PASS |
| 3c | Duplicate signup handled with a clear message (generic confirm message, no account enumeration) | PASS |
| 4 | Password reset end to end: "Forgot password?" on `/login` → email → `/reset-password` sets a new password; invalid/expired token shows "This reset link is invalid or has expired." with a re-request action | PASS |
| 5 | Demo account (`demo@taasflow.com`) logs in reliably every time | NOT VERIFIED — password not available to the test harness (see below) |
| 6 | Zero app-origin console errors on auth surfaces (`/login`, `/reset-password`, all three landings, refresh) | PASS |

Overall: **PASS on items 1-4 and 6. Item 5 unverified**, so the gate is not fully closed.

## Fix applied (auth scope only)

`src/lib/candidate.functions.ts` — `getMyContext` profile auto-claim. The claim lookup ran through the user's RLS client, but the only SELECT policy on `candidate_profiles` is `user_id = auth.uid()`, so an unclaimed row (`user_id IS NULL`) was invisible to the very user entitled to claim it. Every candidate who applied before creating an account therefore landed on the "we couldn't find a candidate profile" screen with no portal, no navigation and no sign-out. The lookup and link now run with the admin client, gated on the auth record's `email_confirmed_at` verified address (never on a token claim), then re-read through RLS as the user. Consequence: `/me`, `/me/applications`, `/me/profile`, `/me/cv`, `/me/messages`, `/me/settings` all render, closing the six BLOCKER rows recorded in the first inventory pass.

## Observations (not fixed — outside auth scope or non-defect)

- `[LOW]` `/login?redirect=…` logs a one-off React hydration warning during the logout bounce. It does not reproduce on a direct load of the same URL; the route is `ssr: false` and the tree re-renders correctly. Dev-mode transition artifact.
- `[LOW]` A React "state update on an unmounted component" warning appeared once on the same logout transition.
- `[LOW]` Every page (public and authenticated) logs one HTTP 400 from the third-party Apollo intent pixel. External vendor call, no app impact.
- Authenticated routes need several seconds in dev before content paints; assertions must wait for a heading rather than `domcontentloaded`.

## Blocking item for full sign-off

Item 5 needs the demo login. The E2E suite already reads `DEMO_CLIENT_EMAIL` / `DEMO_CLIENT_PASSWORD` and skips when absent, and those values are not in this environment, so demo login reliability could not be exercised. Backend state for `demo@taasflow.com` was verified as healthy: active `client_admin` membership on the populated "Northwind Talent (Demo)" workspace.
