# Decision-First Client UI Standard

## Purpose
This document defines how every client-facing page in TaaSFlow should be organized so that a recruiter can make a decision in the first viewport, then drill down only when needed. It is an information-hierarchy rule, not a redesign rule: tokens, typography, colors, and existing components stay unchanged.

## 1. One primary question per page
Every client page must answer one question above the fold:

| Page | Primary question |
|------|------------------|
| Position detail | Should I keep working on this role? |
| Candidate detail | Should I move this candidate forward? |
| Shortlist / board | Which candidates need my attention right now? |
| Talent memory | Who have we already seen for similar roles? |

All supporting detail must live below the first viewport in tabs, accordions, or drawers, reachable within one click/tap from where it was previously shown.

## 2. Decision header pattern (entity pages)
Use the same header structure on every Position, Candidate, and Interview page.

| Zone | Max elements | What goes here |
|------|--------------|----------------|
| Identity line | 1 | Name + context (role/title or current stage). |
| Verdict | 2 | Score + fit band. |
| Reasons for | 3 | Evidence-backed bullets; each must trace to a real requirement, evidence item, or score dimension. |
| To validate | 2 | Only the most important open questions. |
| Contact block | 1 | Released contact info + LinkedIn/location; preview/download links. |
| Primary actions | 3 | The actions that advance the decision (e.g., Approve, Reject, Request interview). |

Everything else — full score breakdown, career history, skills list, activity log, team notes — goes into collapsible sections below.

## 3. Card pattern for lists and Kanban
Any card in a list, board, or comparison grid must show only:

1. Name
2. Score band
3. One-line headline (the strongest fit reason)
4. Current stage
5. One primary action

All other details appear only after the card is opened.

## 4. Density rules

### Desktop (1440px)
The first viewport should answer the primary question without scrolling. Keep interactive elements in the first viewport to no more than ~7, excluding global navigation.

Allowed above the fold:
- Verdict / score
- Up to 3 reasons
- Up to 2 validation items
- Contact block
- Up to 3 primary actions

### Mobile (375px)
The same content must fit vertically; use a single column. If necessary, collapse the "reasons for" and "to validate" lists into one accordion each. Tap targets must be at least 44px.

## 5. Copy rule: evidence-backed statements only
Any claim about why a candidate is a strong fit must be traceable to a real evidence item:

- A matched requirement
- A parsed CV fact
- A screening answer
- A score dimension
- An interview note

Do not use generated filler such as "great communicator" or "strong cultural fit" unless the evidence is explicitly cited. If there is no evidence, use "Not provided" or omit the line.

## 6. Progressive-disclosure checklist
When reorganizing a page, list every piece of information that is moved below the fold:

- Original location
- New location (tab, accordion, drawer)
- How it is reached (one click/tap)
- Evidence source for any claim it contains

## 7. Non-goals
This standard does not authorize:
- New color palettes or typography
- New animations or transitions
- New data models or server functions
- New user roles or permissions
- Removing information entirely (only reorganizing it)

## 8. Verification steps
After applying this standard to a page:

1. Open the page as the Northwind demo client (`demo@taasflow.com`).
2. Verify at 1440px that the primary question is answered in the first viewport.
3. Verify at 375px that no horizontal overflow exists and all tap targets are ≥44px.
4. Re-run the page's existing Playwright spec(s).
5. Report the click-path result in the task response.
