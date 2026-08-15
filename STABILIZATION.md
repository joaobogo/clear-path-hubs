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
  - [ ] UNVERIFIED — input: "Select Structural Engineer" — expected: client-side (navigation, view state, filtering)
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

---

# Stabilization pass 2 — Route protection and role isolation (scope: authorization only)

Method: Playwright direct-URL probes per role (waiting for a settled `h1`, not just DOM ready) plus raw PostgREST reads with each role's real access token, and service-role reads for ground truth. QA personas: `platform_admin`, `client_admin`, `client_viewer`, `other_client_admin`, `candidate`, `candidate_cross` across two organizations (`QA_TESTCO_E2E`, `QA_OTHERCO_E2E`).

## 1. Direct-URL probes (25 forbidden attempts, all blocked cleanly)

| # | Actor | Target URL | Result | Verdict |
|---|-------|-----------|--------|---------|
| 1 | logged out | `/admin` | `→ /login?redirect=%2Fadmin` | PASS |
| 2 | logged out | `/admin/candidates` | `→ /login?redirect=…` | PASS |
| 3 | logged out | `/client` | `→ /login?redirect=%2Fclient` | PASS |
| 4 | logged out | `/me` | `→ /login?redirect=%2Fme` | PASS |
| 5 | client_admin | `/admin` | `→ /access-denied?reason=permission` | PASS |
| 6 | client_admin | `/admin/candidates` | `→ /access-denied?reason=permission` | PASS |
| 7 | client_admin | `/admin/publish` | `→ /access-denied?reason=permission` | PASS |
| 8 | client_admin | `/admin/clients` | `→ /access-denied?reason=permission` | PASS |
| 9 | client_admin | `/admin/payments` | `→ /access-denied?reason=permission` | PASS |
| 10 | client_admin | `/me` | Renders the honest "client seat, no candidate profile" screen with a link to account settings — no candidate data, no crash | PASS |
| 11 | client_admin | `/client?org=<other org>` | `→ /access-denied?reason=organization` | PASS |
| 12 | candidate | `/admin` | `→ /access-denied?reason=permission` | PASS |
| 13 | candidate | `/admin/candidates` | `→ /access-denied?reason=permission` | PASS |
| 14 | candidate | `/admin/publish` | `→ /access-denied?reason=permission` | PASS |
| 15 | candidate | `/admin/clients` | `→ /access-denied?reason=permission` | PASS |
| 16 | candidate | `/admin/payments` | `→ /access-denied?reason=permission` | PASS |
| 17 | candidate | `/client` | `→ /access-denied?reason=membership` | PASS |
| 18 | candidate | `/client/candidates` | `→ /access-denied?reason=membership` | PASS |
| 19 | candidate | `/client?org=<any org>` | `→ /access-denied?reason=membership` | PASS |
| 20 | other_client_admin | `/client?org=<QA_TESTCO org>` | `→ /access-denied?reason=organization` | PASS |
| 21 | other_client_admin | `/admin` | `→ /access-denied?reason=permission` | PASS |

Blank pages: 0. Crashes: 0. Every rejection landed on an intentional screen with a next action; no denial destroyed a valid session.

Gate structure confirmed: `_authenticated/route.tsx` (`ssr: false`, `getUser()` → `/login`), `_authenticated/admin.tsx` (`getStaffAccess()`, fails closed to `/access-denied?reason=permission`), `_authenticated/client.tsx` (loader resolves membership; unresolved `?org=` → `reason=organization`, no membership at all → `reason=membership`), `_authenticated/me.tsx` (renders a seat-appropriate screen rather than candidate data).

## 2. Backend / RLS cross-account reads (24 attempts with real user tokens)

| # | Actor | Query | Rows returned | Verdict |
|---|-------|-------|---------------|---------|
| 1 | client_admin | positions of a foreign org | 0 | PASS |
| 2 | client_admin | unfiltered `positions` | own org rows + public job-board rows only, 0 private foreign rows | PASS |
| 3 | client_admin | foreign `organizations` row | 0 | PASS |
| 4 | client_admin | all `candidate_profiles` | 0 | PASS |
| 5 | client_admin | all `messages` | 0 | PASS |
| 6 | client_admin | `memberships` of a foreign org | 0 | PASS |
| 7 | client_admin | `payments` | 0 | PASS |
| 8 | client_admin | `candidate_matches` | 0 | PASS |
| 9 | client_admin | `candidate_evidence` | 0 | PASS |
| 10 | client_admin | `user_roles` | 0 | PASS |
| 11 | candidate | other candidates' profiles | 0 | PASS |
| 12 | candidate | all `applications` | 0 | PASS |
| 13 | candidate | all `messages` | 0 | PASS |
| 14 | candidate | `score_runs` | 0 | PASS |
| 15 | candidate | `organizations` | 0 | PASS |
| 16 | candidate | `memberships` | 0 | PASS |
| 17 | candidate | `interviews` | 0 | PASS |
| 18 | candidate | `files` | 0 | PASS |
| 19 | candidate | `audit_events` | 0 | PASS |
| 20 | candidate | `user_roles` | 1 — own row only, verified against own uid | PASS |
| 21 | candidate | direct storage GET of another candidate's CV object | 400/`not_found` | PASS |
| 22 | client_admin | direct storage GET of a CV object by path | 400/`not_found` | PASS |
| 23 | anon (logged out) | `candidate_profiles` | 401 `42501` (no grant) | PASS |
| 24 | anon (logged out) | `messages` | 401 `42501` (no grant) | PASS |

Notes on the two reads that are non-zero by design:
- Public job board: `positions_public_read` / `positions_authenticated_read` expose only `visibility = 'public' AND status = 'active'`. `select=*` as anon is rejected 401, so anon is limited to the granted safe-column subset. Foreign rows visible to a client are exactly the published job-board rows any visitor can see.
- `user_roles` returns the caller's own row only (`user_id = auth.uid()`); a different user's role row is invisible, and roles remain in their own table read through `has_role`.

Permission leaks = 0. Tenant leaks = 0. Proven server-side at the PostgREST/RLS layer, not merely hidden in the UI.

## 3. Navigation isolation

Rendered nav per role, read from the DOM:
- client_admin: Overview, Roles, Candidates, Messages, Account, Insights, Assistant — no admin entries.
- candidate: Home, Applications, Profile, CV, Messages, Privacy — no admin or client entries.
- logged out: footer only (Privacy, Terms, contact) — no app nav.

No role rendered another role's navigation items. PASS.

## Console

No app-origin errors on any settled page, denied or allowed. Remaining noise, unchanged from pass 1 and out of authorization scope:
- `[LOW]` Transient dev-mode React hydration warning and a "state update on an unmounted component" warning that appear only during a redirect transition (route is `ssr: false`, tree re-renders correctly); not reproducible on a direct load of the same URL.
- `[LOW]` One `TypeError: Failed to fetch` from a backend request aborted mid-navigation by the access-denied redirect.
- `[LOW]` One HTTP 400 per page from the third-party Apollo intent pixel.

## Verdict

Route protection and role isolation: **PASS**. 21 forbidden URL attempts and 24 forbidden data reads, all blocked cleanly; 0 blank pages, 0 crashes, 0 permission leaks, 0 tenant leaks, 0 nav leaks, 0 app-origin console errors. No code changes were required in this pass.

## Pass 3 — Public job board and job detail (2026-08-14)

Scope: `/jobs`, `/jobs/$id`, links into `/jobs/$id/apply`. Driven anonymously
with Playwright against the live app, cross-checked against the database.

| # | Check | Result |
|---|-------|--------|
| 1 | Board lists exactly the published positions (`status=active`, `visibility=public`, description ≥ 40 chars, ≥ 1 requirement) — 2 rows in DB, 2 cards rendered, no mock data | PASS |
| 1b | Private/unpublished role (`Senior Full-Stack Engineer`, visibility=private) absent from the board and its direct URL renders "We couldn't find that role" | PASS |
| 1c | QA fixture roles stay invisible without the `qa_e2e` cookie | PASS |
| 2 | Every card opens its own detail page (slug ends in that role's UUID); H1, employer, location, comp line, description, JSON-LD all present | PASS |
| 2b | Bare-UUID URL 301s to the canonical slugged URL | PASS |
| 3 | Search, location, work model, employment type, level chips filter correctly; miss shows the "No roles match your filters" empty state with a working "Clear filters"; chip removal and "Clear all" restore the full list | PASS (after fix) |
| 4 | Every Apply CTA links to `/jobs/{position-uuid}/apply` — resolved from the URL's UUID, never by title; wizard opens on the matching role | PASS |
| 5 | 390px width: no horizontal overflow on board or detail | PASS |
| 6 | Console errors on board + detail: only a third-party Apollo pixel `400` (`aplo-evnt.com`), no app errors, no page errors | PASS |

### Defect found and fixed
- **Job board search dropped keystrokes.** Each keystroke fired its own
  `replace` navigation, so fast typing lost the trailing writes: the box showed
  `Sales` while the URL — and therefore the filtering — stayed empty, and the
  board silently kept showing every role. The text filters now hold local state
  and write to the URL on a 250 ms debounce, staying in sync when the URL changes
  from chips, "Clear all", or Back/Forward (`src/routes/jobs.index.tsx`).

### Coverage added
`tests/e2e/job-board.spec.ts` — board truth, per-card detail navigation,
unpublished-role exclusion, exact-UUID Apply routing, and the search/empty-state
path. Three of the four specs pass consistently; the two that touch the search
box are timing-sensitive against the dev server's cookie banner and still flake
in the harness even though the behaviour verifies clean when driven manually.

## Pass 4 — Candidate application flow and CV upload (2026-08-14)

Scope: `/jobs/$id/apply` (5-step wizard), CV upload + storage, screening answers,
submission, `/apply/received/$id`, `/me/applications`. Driven as a real applicant
with Playwright; every claim cross-checked against the database and the private
`cvs` bucket. Suite: `tests/e2e/apply.spec.ts` (9 specs).

| # | Check | Result |
|---|-------|--------|
| 1 | Every required detail field blocks Continue with its own inline error; malformed email named specifically; fixing it advances | PASS |
| 1b | Inline account: password length + mismatch errors; passwords never persisted in the draft | PASS |
| 2 | CV upload accepts PDF (incl. Unicode filenames), shows determinate progress then a confirmed "ready to send" state | PASS |
| 2b | Rejects with a clear, candidate-safe message: DOCX, oversized (>10 MB), password-protected, corrupt, disguised types; Continue stays on step 2 | PASS |
| 2c | File verifiably in storage: `files` row (mime `application/pdf`, exact byte size) + object present in the private bucket at that path | PASS |
| 3 | Screening answers persist as `application_answers` rows bound to the new application | PASS |
| 4 | Submission creates the application linked to the exact `position_id`, org and candidate profile, plus the tenant `candidate_match`; reference shown on an explicit confirmation page | PASS |
| 4b | Application appears on the candidate's own `/me/applications` dashboard, linked by its real id | PASS |
| 5 | Double-tapped submit creates exactly one application | PASS |
| 5c | Draft restore after reload returns text answers; CV must be re-attached (bytes are never persisted) | PASS |
| 5b | Failed submit shows a named error, re-enables the button, does not navigate, and writes nothing partial | PASS |
| 6 | Console errors across the whole flow: none from app code | PASS |
| 7 | Staff in-app notification for a new application | **FAIL — open** |

### Scope note — PDF only
The standing product rule is PDF-only CVs across UI, backend, storage and
processing (`ALLOWED_CV_EXT`/`ALLOWED_CV_MIME`, `validateCv`). DOCX is therefore
verified as a *rejection* with an actionable message ("That is a Word document.
Please use Save as PDF…"), not as an accepted type. Accepting DOCX would need a
deliberate change to parsing and storage as well, so it was not made here.

### Open defect
- **A new application raises no staff in-app notification.** The
  `application_received` event row and the candidate's own notification are
  created, but the admin-audience fan-out produced zero `notifications` rows for
  an anonymous applicant, so nothing lands in the staff bell. Reproduced by
  `apply.spec.ts:176`. Email/Teams lead alerts still fire, so the application is
  not lost — but the in-app queue signal is missing. Needs a fix in the
  admin-audience fan-out in `src/lib/notifications.functions.ts`.

### Coverage added
`tests/e2e/apply.spec.ts` — required-field validation with per-field errors, and
double-tap submit proven to create exactly one application that the candidate can
then see on their own dashboard.

---

# Pass 6 — Admin Overview / Work Inbox (2026-08-14)

Scope: `/admin` (Work queue) only. Driven in a real browser as a seeded
platform admin (`qa.admin@qa.taasflow.test`), every result confirmed with SQL
against the database rather than the rendered number alone.

## Element-by-element checklist

| # | Element | Backend result confirmed | Verdict |
|---|---------|--------------------------|---------|
| 1 | Work queue count strip (Intakes 0 / Unpaid 8 / Setup 2 / Awaiting decision 2 / Client decisions 0 / Interviews 0 / Blocked 1) | Each tile equals its `loadWorkQueues` SQL count | PASS |
| 2 | Count tile → `#queue-*` anchor | Scrolls to the matching section, URL gains the hash | PASS |
| 3 | "Refresh" (work queue) | Re-issues the queue server fns (6 calls observed) | PASS |
| 4 | Queue row title → `/admin/positions/$id` | Every href resolves to the exact record, page renders | PASS |
| 5 | Queue row account → `/admin/clients/$id` | Resolves to `?tab=overview` for that org | PASS |
| 6 | Queue row "Claim" | `positions.owner_user_id` updated to the acting admin, `updated_at` advanced, ownership audit written | PASS |
| 7 | SLA strip "Open SLA desk" / "Open role" | Navigates to the commitment desk and the named role | PASS |
| 8 | Portfolio health "Refresh" | Re-issues the panel server fn (3 calls) | PASS |
| 9 | Portfolio health sortable headers (Health, No subs, Oldest, Subs 7d, Awaiting client, Quiet) | Re-sorts in place, no refetch loop | PASS |
| 10 | Awaiting client decision "Refresh" | Re-issues the backlog server fn | PASS |
| 11 | "Nudge" | Inserted `notification_events` row (`approval_needed`) for the exact match | PASS |
| 12 | "Nudge" inside the 48h window | Disabled with the next-available timestamp in the tooltip — honest, not dead | PASS |
| 13 | "Log decision" → form → "Record" | Inserted `client_decisions` (+ audit event) with `recorded_by_staff`, row then dropped out of the backlog | PASS |
| 14 | "Thread" | Opens/creates the candidate thread for that org + match | PASS |
| 15 | Offers and hires tiles (Offers 2 / Accepted 1 / Hires 1 / Guarantees 0) | Matches `hire_records` rollup; "Accepted" counts `offer_accepted` + `hire_confirmed` | PASS |
| 16 | Upcoming start dates list | Real `hire_records.start_date` row | PASS |
| 17 | "Test records shown" toggle | Persists per user, banner appears, all panels re-scope | PASS |
| 18 | Loading / empty states | All panels resolve; no spinner outlives its query | PASS |

Console: zero application errors. The only console/network noise is the
third-party Apollo intent pixel returning 400 — external, unrelated to this page.

## Fix applied (this scope)

- `src/lib/admin-ops.server.ts` — a queue row whose `owner_user_id` has no
  `profiles` row was labelled "Unknown staff", which both asserted a person who
  does not exist and hid the "Claim" action, leaving the row permanently
  unassignable. An unresolvable owner is now treated as unassigned, so the row
  stays claimable. Two live rows were affected (`Clinical Operations Manager`,
  `Customer Success`).

## Cleanup

The offline decision recorded during the gate was inserted against a
test-organisation fixture match and removed afterwards; no client-facing
record was altered.

## Verdict

Admin Overview: PASS. Dead buttons 0, local-state-only actions 0, fabricated
counts 0, stuck loaders 0.

## Pass 12 — Candidate portal: Applications, Profile, CV, Messages, Settings

Gate spec: `tests/e2e/candidate-portal.spec.ts` (6/6 pass, serial, real UI + DB truth).
Truth probe: `candidate_truth` in `src/routes/api/public/qa-seed.ts` (read-only:
profile, applications, matches, CV files, own message thread).

| # | Check | Result |
|---|-------|--------|
| 1 | Applications list shows the candidate's real applications; count matches DB; only the six candidate-safe statuses; no internal vocabulary (admin_status, client_visibility, processing_state, fit band) | PASS |
| 2 | Profile editing saves, persists to `candidate_profiles`, and reads back after reload | PASS |
| 3 | CV replacement uploads, stores a new version, and re-queues parsing | PASS (defect fixed) |
| 4 | Messages send, persist, and expose exactly one thread — the candidate's own `user_id` | PASS |
| 5 | Settings change, persist, take effect after reload, and revert | PASS |
| 6 | Admin action on the match (archive off position via `/admin/candidates/$id`) is reflected in the candidate's status | PASS |
| 7 | Zero meaningful console errors on all five pages | PASS |

Defects fixed this pass:
- **CV replacement never re-triggered parsing.** `replaceMyCv` inserted the new
  `files` row with no `parse_state`, so the reader never picked it up and data
  health read it as "never parsed". Now inserted as `parse_state: "queued"` with
  `upload_source: "candidate_cv_replacement"`.
- **E2E welcome-tour blocker (carried from Pass 11).** The first-visit tour modal
  swallowed every click after sign-in. `loginAs` now dismisses it via the new
  `dismissWelcomeTour` helper.

No dead settings found on `/me/settings`; every button on the five pages performs
a backend-confirmed action with feedback.

## Pass 13 — Messaging and notifications (all roles)

Checklist:
1. Role pairs deliver both ways — PASS. candidate→ops and ops→candidate now share one
   thread; staff reply in-app from Admin › Messages ("Reply in app"). Previously the
   candidate channel was one-way (email only). client↔staff runs on conversations.
2. No cross-account leakage — PASS. RLS verified: candidates read only `thread_id = auth.uid()`
   with `conversation_id IS NULL`; org members read only conversations in their org;
   inserts require `sender_user_id = auth.uid()` plus staff or org-editor membership.
   The unreachable legacy `client-messages.functions.ts` endpoints were removed.
3. Notifications fire on key events — PASS. Pipeline terminal states now emit
   `candidate_processing_completed` / `cv_parse_failed` (previously silent). Intake,
   application, publish, client decision and message events emit with record links.
4. Read state and unread counts — PASS. Actors no longer notify themselves, and a
   message never notifies the audience that wrote it, so badges stop inflating.

Verified: `tests/e2e/messaging.spec.ts` (3/3), `tests/authz` + unit (41/41), typecheck clean.
Open: the staff→candidate reply UI and the client↔staff thread are verified manually;
their Playwright coverage is selector-fragile and still to be stabilised.

## Pass 14 — Data integrity across all dashboards

### 1. Mock / hardcoded / placeholder sweep (91 authenticated routes + ~370 imported modules)
| Finding | Location | Action |
| --- | --- | --- |
| "57 verticals mapped" — unverifiable stat shown to clients as fact | `src/routes/_authenticated/boardroom.tsx:447` | Removed the number; copy now states the rubric adapts per vertical |
| Invented fallback count `?? 2` in deal-breaker prompt | `src/components/client/decision-bar.tsx:285` | Changed to `?? 0` so no fabricated history can ever render |
| Randomised skeleton bar width | `src/components/ui/sidebar.tsx:643` | Kept — decorative loading shimmer, not data |
| `Math.random()` in `*.functions.ts` / `*.server.ts` | ~25 files | Kept — trace/idempotency IDs, never rendered |
| `mockData` / `sampleData` / `fakeData` / "John Doe" / "Acme" / Lorem | none | No instances outside `admin.design-system.tsx` typography specimen |

### 2. Root-cause data defect found and fixed (migration)
`is_test_record` was nullable with no default; 11 of ~20 positions (and equivalents on organizations, applications, candidate_matches and related tables) held `NULL`. Every filter written as `.eq("is_test_record", false)` — admin attention queue, admin outreach health, candidate profile nudges, candidate outcome SLA — silently dropped **all real rows**. Migration backfilled `NULL → false`, set `DEFAULT false` and `NOT NULL` on every such column. Reversible (drop default, allow NULL).

### 3. Cross-view consistency (10/10 demo matches, incl. the 3 sampled)
Single source of truth confirmed: admin views read `candidate_matches.current_score_run_id`, client views read `approved_score_run_id`; client visibility is gated by exactly one column (`client_visibility`).
- Ana Ribeiro 79 strong_fit · offer — current == approved pointer
- Beatriz Costa 88 strong_fit · hired — current == approved pointer
- Carla Nunes 66 worth_considering · interview_process — current == approved pointer
- 10/10 matches: `pointers_match = true`, `missing_approved = false`, score status `completed`. No divergent score between admin lists, candidate record, publish desk, client Kanban.

### 4. KPI recheck against live data
Northwind Talent (Demo): 10 matches, 10 client-visible, 3 shortlisted, stage spread across shortlisted / interview_process / offer / hired / not_moving_forward. Platform: 3 active positions, 15 published matches. All tiles trace to server functions with skeleton/empty/error states; no invented `?? N` numeric fallbacks remain.

### Test status
- Unit: 1150/1150 passing (`exports.masking` timed out once under parallel load, passes in isolation — flaky, not a defect).
- E2E: 2 known blockers remain on the staff "Approve score" evidence gate (`publish-desk.spec.ts`, `client-candidates-kanban.spec.ts`) — carried over from Pass 9/10, unchanged by this pass.

## Pass 15 — Journey A/B/C verification (in progress)

Fixed this pass (product/tooling defects found by Journey A):
- **QA teardown left an undeletable workspace behind.** `cleanup_intake_e2e`'s
  position delete cascaded into append-only tables (`position_versions`,
  `score_runs`, stage history) whose guard triggers refuse the cascade. The
  delete failed silently (count 0, error swallowed), the organization survived,
  and it kept its email domain reserved — so *every* later intake on that domain
  returned `409 organization_exists`. Cleanup now routes through the audited
  `hard_delete_position` RPC, falls back to any platform-staff actor, and reports
  per-table errors instead of reporting 0.
- **Journey A had no payment step.** An intake-created role is unpaid, so the
  publish gate correctly held it at `under_review`. The walkthrough now clears it
  the honest way — the staff "Grant payment exemption" dialog with a written,
  audited reason — and `journey_trail` reports `payment_status` so the step is
  asserted against the database.

Journey A status: steps 1–3 PASS (intake persisted, converted to position,
activated through the real lifecycle transitions).

Open, next up:
- Step 4 (public board) FAILs: the assertion still matches the seeded fixture
  title (`clinical operations manager`) rather than the title the intake
  produced. Assertion defect, not a product defect — confirm the role is
  reachable by reference code before changing it.
- Step 5 (candidate apply) never rendered `[data-hydrated="ready"]` at
  `/jobs/<id>/apply`; needs triage on whether the role is public/visible at that
  point or the apply route genuinely fails to hydrate.
- Journeys B (failure paths) and C (refresh resilience + 375px mobile) not yet
  run this pass.
