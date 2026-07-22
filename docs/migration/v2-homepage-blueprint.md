# V2 Homepage Blueprint

**Positioning:** The V2 homepage must lead with the Client workspace as the primary product differentiator — ranked candidates with evidence, a live pipeline, and synchronized decision-making — not with a generic "subscription recruiting" pitch.

**This document defines section order, purpose, source, CTA, and required dashboard visuals. It does not design the page.**

## Proposed section order

| # | Section | Purpose | Content source | CTA (primary → destination) | Required dashboard visual | Rewrite status |
|---|---|---|---|---|---|---|
| 1 | Hero | State the differentiator: "See every candidate ranked, with evidence, in one workspace." | New copy (workspace-first) | "Start a pilot" → `/pilot` | Screenshot of Client Kanban (`/client/positions/$id`) with 3 stages visible | REWRITE |
| 2 | Trust bar | Anchor credibility (client logos or stat strip) | Source home | none | none | KEEP (VERIFY logos) |
| 3 | Ranked candidates | Show the 0-100 score, role fit, evidence pillars | Source `/how-it-works` + V2 scoring engine | "See how scoring works" → `/how-it-works` | Candidate card from `CandidateDetailDrawer` (Overview + Score tabs) | REWRITE |
| 4 | Transparent hiring progress | Pipeline visibility across stages | Source home | "Explore the workspace" → `/how-it-works#workspace` | Kanban with stage counts + activity timeline | REWRITE |
| 5 | Role-specific evidence | Structured `candidate_evidence` per requirement | New copy (V2 feature) | none | Evidence tab from `CandidateDetailDrawer` | NEW (V2-only) |
| 6 | Live client workspace | Real-time updates, notifications, chat with recruiter | Source home | "See a live workspace" → `/pilot` | Kanban + notifications panel | REWRITE |
| 7 | Faster decision-making | Time-to-decision stat + inline actions | Source home + V2 KPIs | "Book a walkthrough" → `/contact` | Client dashboard KPI strip | REWRITE (VERIFY stat) |
| 8 | Candidate comparison | Side-by-side comparison of shortlist | New copy (V2 feature) | none | Compare view (if built) or 3 candidate cards | NEW (V2-only) |
| 9 | Complete pipeline visibility | Every stage, every decision, one place | Source home | "See how it works" → `/how-it-works` | Full pipeline overview screenshot | REWRITE |
| 10 | Synchronized updates | Realtime + notifications + audit | New copy (V2 feature: `notification_events`, `use-realtime-refresh`) | none | Notifications drawer | NEW (V2-only) |
| 11 | Predictable recruiting model | Subscription + no placement fees | Source `/pricing` | "See pricing" → `/pricing` | none | KEEP (VERIFY claims) |
| 12 | How it works (3-step) | Intake → Ranked shortlist → Hire | Source `/how-it-works` | "Start a pilot" → `/pilot` | none | KEEP |
| 13 | Industries strip | Link to `/industries` grid | Source home | "Browse industries" → `/industries` | none | KEEP |
| 14 | Case studies (if verified) | Short testimonial quotes | Source `/case-studies` | "Read case studies" → `/case-studies` | none | VERIFY |
| 15 | Final CTA | Convert to pilot or intake | New copy | "Start a $399 pilot" → `/pilot` · "Talk to us" → `/contact` | none | REWRITE (VERIFY price) |
| 16 | Footer | Nav + legal | `site-shell.tsx` footer | — | none | KEEP |

## Content requiring rewrite (net-new for V2)

- Hero headline + subhead.
- Sections 5, 8, 10 (evidence, comparison, synchronized updates) — no equivalent copy exists on the source; write against V2 features.
- Every claim tagged VERIFY in `public-content-inventory.md` must be resolved before hero, pricing, or CTA sections publish.

## Required dashboard screenshots (production capture list)

Capture from a seeded demo org where every candidate is scored and published; hide PII.

1. Client Kanban with 3+ stages populated.
2. `CandidateDetailDrawer` — Overview tab.
3. `CandidateDetailDrawer` — Score tab (0-100 with pillar breakdown).
4. `CandidateDetailDrawer` — Evidence tab.
5. Notifications panel with 2-3 recent events.
6. Client dashboard KPI strip (open positions, in-review, shortlisted, hired).

## What the homepage must **not** show

- Admin-only views (Publish Desk, Support Mode banner).
- Any real candidate name, email, or CV thumbnail.
- Any Supabase / legacy dashboard chrome.
