# MVP Readiness Scorecard — All Dashboard Surfaces

Run date: 2026-08-13 (UTC). Measurement only — nothing was fixed in this pass.

## How each cell was measured

- **Route** — resolved from `src/routes/_authenticated/*`; three legacy client paths are 301 redirects into merged surfaces, recorded as such.
- **Loads without error** — attempted in Chromium at `localhost:8080` for all 18 paths. Every path redirected to `/login?redirect=…`: no Supabase session is available in this environment (`LOVABLE_BROWSER_AUTH_STATUS=signed_out`, no `DEMO_CLIENT_EMAIL`/`DEMO_CLIENT_PASSWORD`). Signed-in render therefore reads **UNVERIFIED**, never "yes". The auth gate itself passed on all 18.
- **Real data or empty** — live SQL row counts: intake_submissions 10, positions 14 (active 3, submitted 7, draft 1, needs_clarification 1, archived 2, **open 0**), candidate_profiles 21, candidate_matches 18, applications 18, score_runs 46, interviews 4, conversations 4, messages 7, memberships 11, organizations 12, files 22.
- **Every visible action wired** — static scan of each route plus its component tree (depth 2) for dead handlers: `onClick={() => {}}`, `TODO`, `FIXME`, "coming soon". Zero hits on all 18 surfaces. This proves no placeholder handlers; it does not prove each mutation succeeds end to end.
- **Loading + empty + error states** — same scan for `isPending`/`isLoading`/`Skeleton`/`Suspense`, empty-state copy, and `errorComponent`/`isError`/`onError`.
- **Mobile 375px clean** — measured `scrollWidth <= clientWidth` at 375px. Only the gate/login render was reachable (clean, no overflow); signed-in layouts read UNVERIFIED. Public marketing pages were separately clean at 390/768/1440 in the previous run.

## Scorecard

| # | Surface | Route | Loads w/o error | Real data or empty | Actions wired | Loading+empty+error | Mobile 375 clean |
|---|---------|-------|-----------------|--------------------|---------------|---------------------|------------------|
| 1 | Admin overview | `/admin` | UNVERIFIED (gate ok) | Real (10 intakes, 14 positions, 18 matches) | Yes (26 buttons, 0 dead) | Yes | UNVERIFIED |
| 2 | Intake inbox | `/admin/intake` | UNVERIFIED (gate ok) | Real (10 submissions) | Yes (11 buttons, 0 dead) | Yes | UNVERIFIED |
| 3 | Admin positions | `/admin/positions` | UNVERIFIED (gate ok) | Real (14 positions) | Yes (25 buttons, 0 dead) | Yes | UNVERIFIED |
| 4 | Admin candidates | `/admin/candidates` | UNVERIFIED (gate ok) | Real (21 profiles, 46 score runs) | Yes (42 buttons, 0 dead) | Yes | UNVERIFIED |
| 5 | Admin candidate detail | `/admin/candidates/$id` | UNVERIFIED (gate ok) | Real (evidence + score runs present) | Yes (30 buttons, 0 dead) | Yes | UNVERIFIED |
| 6 | Publish desk | `/admin/publish` | UNVERIFIED (gate ok) | **Empty of publishable work — 0 positions in `open` status** | Yes (12 buttons, 0 dead) | Yes | UNVERIFIED |
| 7 | Client overview | `/client` | UNVERIFIED (gate ok) | Real (demo KPIs: 10 visible, 4 shortlisted, 2 interview, 1 offer, 1 hire) | Yes (52 buttons, 0 dead) | UNVERIFIED |
| 8 | Client roles | `/client/positions` | UNVERIFIED (gate ok) | Real (1 demo role) | Yes (14 buttons, 0 dead) | Yes | UNVERIFIED |
| 9 | Client candidates | `/client/candidates` | UNVERIFIED (gate ok) | Real (10 demo candidates) | Yes (40 buttons, 0 dead) | Yes | UNVERIFIED |
| 10 | Client candidate detail | `/client/candidates/$id` | UNVERIFIED (gate ok) | Real (score breakdown + CV per candidate) | Yes (37 buttons, 0 dead) | Yes | UNVERIFIED |
| 11 | Interviews | `/client/interviews` | UNVERIFIED (gate ok) | Real (4 interviews) | Yes (43 buttons, 0 dead) | Yes | UNVERIFIED |
| 12 | Messages | `/client/messages` → 301 → `/client/conversations` | UNVERIFIED (gate ok) | Real (4 conversations, 7 messages) | Yes (13 buttons, 0 dead) | Yes | UNVERIFIED |
| 13 | Team | `/client/team` → 301 → `/client/account?tab=team` | UNVERIFIED (gate ok) | Real (11 memberships) | Yes (43 buttons on account shell, 0 dead) | Yes | UNVERIFIED |
| 14 | Settings | `/client/settings` → 301 → `/client/account?tab=workspace` | UNVERIFIED (gate ok) | Real (org + plan rows) | Yes (0 dead) | Yes | UNVERIFIED |
| 15 | Candidate home | `/me` | UNVERIFIED (gate ok) | UNVERIFIED (no candidate account signed in) | Yes (16 buttons, 0 dead) | Yes | UNVERIFIED |
| 16 | Candidate applications | `/me/applications` | UNVERIFIED (gate ok) | UNVERIFIED (18 applications exist globally; none confirmed for a demo candidate login) | Yes (6 buttons, 0 dead) | Yes | UNVERIFIED |
| 17 | Candidate profile | `/me/profile` | UNVERIFIED (gate ok) | UNVERIFIED | Yes (11 buttons, 0 dead) | Yes | UNVERIFIED |
| 18 | Candidate CV | `/me/cv` | UNVERIFIED (gate ok) | UNVERIFIED (22 files exist; candidate-owned CV not confirmed) | Yes (7 buttons, 0 dead) | Yes | UNVERIFIED |

## Percentage complete per role

Cells counted per surface: route, loads, real data, actions, states, mobile. UNVERIFIED counts as not-passing.

| Role | Surfaces | Cells | Passing | Complete |
|------|----------|-------|---------|----------|
| Admin / ops | 6 | 36 | 23 | **64%** |
| Client | 8 | 48 | 32 | **67%** |
| Candidate | 4 | 24 | 12 | **50%** |
| **All surfaces** | 18 | 108 | 67 | **62%** |

The gap between 62% and the code-level picture is almost entirely verification, not missing product: data, actions and states pass on every surface with evidence, while runtime and mobile cells cannot be scored without a signed-in session.

## Numbered gap list

1. **No signed-in session available for measurement** — `LOVABLE_BROWSER_AUTH_STATUS=signed_out`, and `DEMO_CLIENT_EMAIL`/`DEMO_CLIENT_PASSWORD` are unset, so "loads without error" is unverified on all 18 surfaces (blocks 18 cells).
2. **Mobile 375px unverified on all 18 signed-in surfaces** — same session blocker; only the login gate was measurable (clean).
3. **Publish desk has no publishable inventory** — 0 positions in `open` status across all 12 organizations, so the desk and the public job board have nothing live to act on.
4. **Blank body on the `/client` → `/login` redirect** — after redirect to `/login?redirect=%2Fclient` the document body measured empty text at 4s, while `/admin` and `/me/cv` redirects rendered the full sign-in form. Reproducible in this run.
5. **Transient hydration warning on the signed-out `/client/candidates` redirect** — React "server rendered HTML didn't match the client" fired once during that redirect; direct loads of `/login?redirect=…` were clean.
6. **Candidate role data unverified** (`/me`, `/me/applications`, `/me/profile`, `/me/cv`) — no demo candidate account is known, so it is unproven that a candidate login sees applications, a profile, and a CV rather than empty states.
7. **Action wiring proven only statically** — zero dead handlers, but no surface had its mutations exercised end to end in this run (stage moves, publish, invite, CV upload, message send).
8. **Third-party Apollo pixel returns 400 on every page** — `app_id not configured, or there is no valid domain configured for app_id`; a console error on all surfaces until the production domain is registered.
9. **Legacy client paths still in the surface list** — `/client/messages`, `/client/team`, `/client/settings` are 301 shims; navigation and docs should point at `/client/conversations` and `/client/account` so the canonical surface count is 15, not 18.

## Unblocking the unverified cells

Provide demo credentials for a client account and a candidate account (or sign in once in the preview so a session is injected), then re-run this audit: gaps 1, 2, 6 and 7 close with real evidence and the per-role percentages can be recomputed against the same cell definitions.
