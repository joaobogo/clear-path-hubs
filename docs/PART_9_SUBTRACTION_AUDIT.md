# Part 9 · Subtract, then perfect what is left

Prompt 60 — full inventory, kill list, merge list, and what was executed.

## 1. Inventory (before)

| Surface | Screens | Sidebar entries |
| --- | --- | --- |
| Client workspace | 31 route files | **15** |
| Admin workspace | 39 route files | **25** |
| Candidate workspace | 9 route files | 6 |
| Public / marketing | 57 route files | 12 |

The problem was not the number of files, it was the number of *decisions* in the
rail. Fifteen and twenty‑five item sidebars make a product feel unfinished:
every row implies a destination worth visiting, and most of them were one panel.

## 2. Merge list (executed)

Related screens are now **one nav entry with tabs**. Tabs are real links, so
deep links, bookmarks, notification links and the back button all keep working.
Nothing was deleted.

**Client — 15 entries → 9**

| Section (nav entry) | Tabs merged into it |
| --- | --- |
| Roles | Roles · Interviews · Offers · Deliveries |
| Candidates | Shortlist · Talent pool · Talent memory · Shared links |
| Insights | Questions · Dashboards · Your data · Executive · Portfolio |
| Assistant | Assistant · Agents · Outreach |
| Account | Account · Team · Plan & billing · Settings |

Kept standalone: Overview, Approvals, Messages, Talent memory.

**Admin — 25 entries → 11**

| Section (nav entry) | Tabs merged into it |
| --- | --- |
| Quality | Scoring review · Orphans · Business rules · QA report |
| Comms | Messages · Notifications · Copilot |
| Operations | Operations · SLA clock · Weekly review · System health · Data health |
| Platform | Payments · Pending leads · Dashboard requests · Support view |
| Team & Access | Team · Settings · Design system |

Kept standalone: Overview, Intake, Clients, Positions, Candidates, Publish Desk.

## 3. Kill list

| Screen | Verdict | Action |
| --- | --- | --- |
| `/client/inbox` | duplicate of Conversations | already a redirect, kept for old links |
| `/client/messages` | duplicate of Conversations | already a redirect, kept for old links |
| `/client/data` | decorative next to Insights | demoted to a tab under Insights |
| `/client/executive`, `/client/portfolio` | unreachable from the rail | demoted to tabs under Insights |
| `/client/interviews`, `/client/offers`, `/client/deliveries`, `/client/shares`, `/client/talent-pool`, `/client/analytics` | orphaned — no nav entry at all | now reachable as tabs |
| `/admin/scoring/orphans`, `/admin/qa-report`, `/admin/data-health`, `/admin/sla`, `/admin/notifications`, `/admin/design-system` | staff sub‑panels, not destinations | demoted to tabs |
| `/dev/catalogue`, `/dev/industry-coverage` | internal tooling | kept, not linked from product nav |

## 4. Dead ends closed (prompt 62)

Six client screens and six admin screens previously had **no route into them
from the product** — they were only reachable by typing the URL. All twelve are
now reachable, and every tab row gives a person a next step on any screen they
land on, including empty and permission‑denied states.

## 5. Consistency notes

- Section tabs are a single shared component (`src/components/workspace/section-tabs.tsx`)
  rendered by the layout, so every section behaves identically: same spacing,
  same active treatment, same focus ring, same keyboard order.
- Manage‑only gating moved off the nav list onto an explicit path list, so
  hiding a row from the rail can never silently widen access.
- Hardcoded colour audit: the workspace is on brand tokens; the only remaining
  literals are in `/boardroom`, which is a deliberate dark presentation surface.
