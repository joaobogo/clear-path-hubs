# TaaSFlow CTA Inventory

Canonical CTA lexicon and per-surface audit. Every CTA on the public site must
map to one of the allowed labels below. Each section can carry **at most one
primary** CTA.

## Allowed labels

### Employer (primary)
- **Start Hiring** → `/intake`   *(the only employer primary)*

### Employer (secondary)
- **See How It Works** → `/how-it-works`
- **View Pricing** → `/pricing`
- **Book a Call** → `/contact`
- **Explore Industries** → `/industries`

### Candidate
- **Browse Jobs** → `/jobs`
- **Join Talent Network** → `/candidates`
- **Candidate Sign In** → `/auth?tab=signin`

### Contextual (tertiary text links only — never a button)
- **Browse all resources** → `/resources`
- **View all FAQs** → `/faq`
- **View industry** → `/industries/{slug}`

## Rules

1. No vague CTAs. Banned: *Learn more*, *Get started*, *Click here*, *Discover*, *Explore* (except **Explore Industries**), *Try it*, *Sign up* (candidate context uses *Join Talent Network*).
2. Maximum **one primary** (navy solid button) per section.
3. Maximum **one secondary** (bordered button) per section unless the section is a conversion terminus (hero, final CTA).
4. No self-referential CTAs (a page must not CTA to itself).
5. Never mix employer and candidate primaries in the same section.
6. Text-link tertiaries (underline / arrow) are exempt from the primary-count rule.

## Homepage inventory (post-audit)

| Section (in order)     | Primary                | Secondary                    | Tertiary                        |
| ---------------------- | ---------------------- | ---------------------------- | ------------------------------- |
| 1. Hero                | Start Hiring → /intake | See How It Works             | —                               |
| 2. Trust               | —                      | —                            | —                               |
| 3. What you receive    | —                      | —                            | —                               |
| 4. Calculator          | *(in-component CTA)*   | —                            | —                               |
| 5. Model comparison    | —                      | —                            | View Pricing                    |
| 6. How it works        | See How It Works       | —                            | —                               |
| 7. Workspace tour      | —                      | —                            | —                               |
| 8. Audience selector   | —                      | —                            | —                               |
| 9. Industries          | —                      | Explore Industries           | View industry (per card)        |
| 10. Proof              | *(in-component)*       | —                            | —                               |
| 11. Resources          | —                      | —                            | Browse all resources            |
| 12. FAQ                | —                      | —                            | View all FAQs                   |
| 13. Final CTA          | Start Hiring           | Book a Call                  | —                               |

Total primaries on the homepage: **3** (hero, how-it-works, final CTA). Each
belongs to a distinct conversion moment (top-of-page intent, mid-page process
belief, bottom-of-page decision).

## Nav / footer

- **Top-nav primary**: Start Hiring
- **Top-nav secondary**: Candidate Sign In
- **Footer employer column**: See How It Works · View Pricing · Explore Industries · Book a Call
- **Footer candidate column**: Browse Jobs · Join Talent Network · Candidate Sign In

## Route-level audit (public surfaces)

| Route              | Primary allowed                        | Notes                                                        |
| ------------------ | -------------------------------------- | ------------------------------------------------------------ |
| `/`                | Start Hiring                           | See table above.                                              |
| `/how-it-works`    | Start Hiring                           | Secondary: View Pricing.                                     |
| `/pricing`         | Start Hiring                           | Secondary: Book a Call. No self-referential *View Pricing*.  |
| `/enterprise`      | Book a Call                            | Enterprise-qualified — Book a Call is primary intent.        |
| `/industries`      | Start Hiring                           | Explore Industries is self-referential here — remove.        |
| `/industries/$slug`| Start Hiring                           | Secondary: See How It Works.                                 |
| `/case-studies`    | Start Hiring                           | Secondary: Book a Call.                                      |
| `/blog/$slug`      | Start Hiring *(mid-article SubtleCta)* | Tertiary: Browse all resources at foot.                      |
| `/resources`       | Start Hiring                           | Text-link only, no self-referential *Browse all resources*.  |
| `/faq`             | Start Hiring                           | No self-referential *View all FAQs*.                         |
| `/contact`         | *(form submit)*                        | No competing CTA; form is the primary action.                |
| `/jobs`            | Join Talent Network                    | Candidate primary; no employer CTA on job-board surface.     |
| `/candidates`      | Join Talent Network                    | Secondary: Browse Jobs.                                      |
| `/auth`            | *(form submit)*                        | No competing CTA.                                            |

## Conversion ladder rationale

Each section's CTA answers the buyer question that opened the *next* section:

1. Hero — "Am I in the right place?" → **Start Hiring** commits, **See How It Works** defers.
2. Trust — proof of category → no CTA (setup for section 3).
3. What you receive — "What do I actually get?" → answered, no CTA (setup for section 4).
4. Calculator — "What does it cost?" → answered inline.
5. Model comparison — "Vs. the alternatives?" → **View Pricing** tertiary.
6. How it works — "How does it actually happen?" → **See How It Works**.
7. Workspace tour — "What does the product look like?" → answered visually.
8. Audience selector — "Is it for me?" → answered by selector.
9. Industries — "Is it for my industry?" → **Explore Industries**.
10. Proof — "Do I trust it?" → in-section CTAs.
11. Resources — "Where can I learn more?" → **Browse all resources**.
12. FAQ — "Any risk?" → **View all FAQs**.
13. Final CTA — "Ready to decide" → **Start Hiring** + **Book a Call**.

## Change log

- 2026-07-23 — Hero primary renamed *Open a role* → **Start Hiring**; tertiary anchor *Compare to agency fees* removed (self-referential).
- 2026-07-23 — Final CTA secondary renamed *Book a Conversation* → **Book a Call**.
- 2026-07-23 — Industries preview CTA renamed *View All Industries* → **Explore Industries**.
- 2026-07-23 — Homepage collapsed from 20 sections to the 13-section conversion ladder; duplicate workspace/audience/agency sections removed.
