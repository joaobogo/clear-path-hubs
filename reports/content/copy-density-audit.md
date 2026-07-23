# Copy Density & Comprehension Audit — Public Site

**Verdict:** PASS
**Method:** Read every public route as delivered by the current build. For each section: five-second comprehension test (can a first-time reader restate what the section offers?), density scan (paragraph length, adjective load, repetition), CTA test (is the next step obvious?).

## Global findings

Walls of text: **0**
Repeated core sections: **0** — agency comparison lives only in `model-comparison`, process lives only in `operating-system`, ranked delivery lives only in `client-candidate-delivery`.
Generic unexplained AI claims: **0** — every AI reference names what it *does* (ranks, extracts evidence, drafts summary) and pairs with the human-review step.
Unclear primary CTAs: **0** — every page's hero CTA points to a single next action ("Start intake", "Book a walkthrough", "Browse jobs").

## Page-by-page 5-second test

| Page              | 5-sec restatement | Hero copy density | Primary CTA | Verdict |
|-------------------|-------------------|-------------------|-------------|---------|
| Homepage hero     | "Ranked candidates, human-reviewed, on a subscription."  | Eyebrow 4w · Headline 9w · Sub 24w | "Start intake" | PASS |
| ROI calculator    | "Model cost-per-hire vs my current spend."               | Section intro 18w | "See the calculation" | PASS |
| Candidate delivery| "Ranked candidates with evidence I can audit."           | Intro 22w         | "Open workspace"   | PASS |
| Operating system  | "Eight stages, TaaSFlow owns some, I own some."          | Intro 21w         | "Read the workflow"| PASS |
| Pricing           | "Subscription tiers, ROI calculator embedded."           | Intro 19w         | "Book a walkthrough" | PASS |
| Enterprise        | "For hiring at scale — dedicated pod, SLAs."             | Intro 22w         | "Talk to enterprise" | PASS |
| Industries        | "57 verticals, searchable, each with a real page."       | Intro 17w         | "Open explorer"    | PASS |
| Staffing partners | "White-label pipelines for agencies."                    | Intro 18w         | "Partner intake"   | PASS |

All hero blocks stay within the Premium guardrails: eyebrow ≤5 words, headline ≤10 words, paragraph ≤35 words.

## Preservation checklist

The following required messages remain **present, specific, and non-generic** on the site:

- Specific service explanation — `/how-it-works`, homepage Operating System.
- Ranked candidate delivery — homepage `client-candidate-delivery`, `/how-it-works`.
- Human review — homepage hero sub, Operating System stage "Human review", `/enterprise`.
- Workspace transparency — homepage Workspace Tour, `/how-it-works`, `/enterprise`.
- Client control — Model Comparison ("Client owns pipeline"), Pricing FAQ.
- Subscription model — Pricing, homepage Model Comparison, `/enterprise`.
- Candidate pipeline ownership — Model Comparison, Pricing terms.
- Audience-specific value — Homepage Audience Selector (Founders, HR, Enterprise, Agencies).
- Industry-specific expertise — `/industries` + 57 leaf routes.

## Cuts made this pass

Nothing new was cut in this audit — the previous rebuild passes already collapsed:

- Long feature descriptions on `/how-it-works` → 8-stage flow.
- Duplicate agency comparison on `/about` and `/pricing` → single Model Comparison on homepage.
- Duplicate process explanations on `/enterprise` and `/how-it-works` → shared Operating System reference.
- Decorative superlatives ("world-class", "cutting-edge", "revolutionary") removed during Premium rebuild.
- Vague AI claims ("AI-powered platform") replaced with specific verbs ("ranks candidates", "extracts evidence", "drafts summary").

Verified by grep: 0 matches for `world-class|cutting-edge|revolutionary|next-generation|state-of-the-art` in `src/routes/` and `src/components/marketing/`.

## Progressive disclosure inventory

Detail lives one interaction away, not on the surface:

- Model Comparison: 7-dimension rail — surface shows a short line, tap reveals the full explanation.
- Operating System: 8 stage tabs — surface shows title + one-line summary, active stage renders detail.
- Workspace Tour: 6 tabs — active panel renders detail.
- Industry Explorer: 57 industries behind a searchable rail; each industry has its own detail route.
- Resources: insight cards → linked article for depth.
- FAQ: native disclosure, question visible, answer on tap.

## Non-blocking observations

- `/enterprise` "What's included" list is dense. It's already a scannable list, not a paragraph, so it stays. Consider grouping under 3 headers if user feedback flags it.
- `/pricing` FAQ block reuses site-wide FAQ styling; content is unique to pricing (billing, cancellation). No overlap with `/faq`.

## PASS conditions

- Walls of text: 0 ✓
- Repeated core sections: 0 ✓
- Generic unexplained AI claims: 0 ✓
- Unclear primary CTAs: 0 ✓
