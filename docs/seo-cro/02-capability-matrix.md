# 02 Capability matrix

Purpose: one table of what TaaSFlow says it can do, with an honest status for each capability and the public page that describes it. It is derived from `src/config/integrations-directory.ts` (integrations), `src/config/agent-roster.ts` (agents and automations), `src/config/channel-agents.ts` (sourcing channels) and `src/config/offer-facts.ts` (notes about ATS, job boards and uploads). The owner-verification date column is intentionally empty: nobody outside the code has confirmed these statuses yet.

Last updated: 7 October 2026

## Status vocabulary

| Status | Meaning here | Mapping from code |
| --- | --- | --- |
| Live | Implemented and usable by a customer today | `availability: "available"` (integrations); roster entries whose operating state says "Always on" or "Switchable per organisation" |
| Live (beta) | Implemented, labelled beta | `availability: "beta"` |
| Human-assisted | Delivered by TaaSFlow staff with the customer, set up per engagement | `availability: "custom"`; recruiter review step |
| Planned | Not built; no date promised | `availability: "planned"` |
| Unavailable | Switched off for customers | Payments (`PAYMENTS_ENABLED=false`) |

"Owner verified" must stay `Unknown` until the owner records a date. The directory file itself carries a code-review date of 7 October 2026 (`INTEGRATIONS_LAST_REVIEWED`), which is not an owner verification.

## Integrations (`integrations-directory.ts`)

Entries with `public: false` are internal plumbing and are not listed on `/integrations`.

| Capability | Status | Listed publicly | Described at | Owner verified |
| --- | --- | --- | --- | --- |
| Agent connectivity (MCP): an external assistant reads your roles, shortlists and evidence, read-only, with your own permissions | Live | Yes | `/integrations`, `/how-it-works` | Unknown |
| Intake and application endpoints (submit a brief or check status over HTTPS) | Human-assisted (custom setup: payload agreed during onboarding) | Yes | `/integrations` | Unknown |
| Outbound webhooks to your systems | Planned: "subscriber management, retries and signing are not built" | Yes | `/integrations` | Unknown |
| Payment webhooks | Internal, available | No | none | Unknown |
| Attio CRM mirror | Internal, available | No | none | Unknown |
| Calendly | Removed from the public integrations list when booking was removed. No public page offers scheduling. | No | n/a | n/a |
| Transactional email | Live | Yes | `/integrations` | Unknown |
| Microsoft Teams notifications | Live (beta) | Yes | `/integrations` | Unknown |
| Online payments (card processor) | Planned / Unavailable: "Online checkout is switched off for now. Packages are requested and invoiced by TaaSFlow directly." | Yes | `/integrations`, `/pricing` | Unknown |
| Google sign-in | Live | Yes | `/integrations`, `/login` | Unknown |
| Website analytics and consent | Internal, available | No | `/privacy` | Unknown |
| In-workspace hiring analytics | Internal, available | No | none | Unknown |
| Applicant tracking system sync | Planned: "No ATS connector is implemented." The workspace includes its own applicant tracking (`ATS_NOTE`). | Yes | `/integrations`, `/how-it-works`, `/faq` | Unknown |
| Job board distribution | Planned: roles are published on the TaaSFlow job board only (`JOB_BOARD_NOTE`) | Yes | `/integrations`, `/jobs` | Unknown |
| Third-party candidate data sources (enrichment) | Planned: "No external enrichment source is connected." | Yes | `/integrations` | Unknown |

## Agents and automations (`agent-roster.ts`)

The roster has 8 entries: 5 switchable agents and 3 always-on automations (`ROSTER_COUNTS`, derived from the array, so public counts cannot drift). Roster activity text is labelled "Representative data" and is illustrative.

| Capability | Kind | Status | Operating state in code | Described at | Owner verified |
| --- | --- | --- | --- | --- | --- |
| Intake Agent (validates the requisition, moves applications through parse, hydrate, enrich) | Automation | Live | Always on | `/agents`, `/how-it-works` | Unknown |
| Blueprint Agent (compiles a versioned rubric; sourcing waits for approval) | Automation | Live | Always on | `/agents`, `/how-it-works` | Unknown |
| Talent Discovery Agent (sourcing, market research) | Agent | Live, off by default per organisation; when off, longlists are built by hand | Switchable | `/agents` | Unknown |
| Evidence Agent (verifies evidence items) | Agent | Live; when off, applications wait for manual review | Switchable | `/agents` | Unknown |
| Scoring Agent (same inputs and engine version give the same score) | Agent | Live | Always on once evidence is ready | `/agents`, `/how-it-works` | Unknown |
| Pipeline Agent (spots stalled roles) | Agent | Live | Switchable | `/agents` | Unknown |
| Coordination Agent (interviews and replies) | Agent | Live; when off, no messages leave the platform | Switchable | `/agents` | Unknown |
| Governance Agent (audit events) | Automation | Live | Always on, cannot be switched off | `/agents` | Unknown |

## Sourcing channels (`channel-agents.ts`)

`CHANNEL_AGENT_COUNT` is 23, the sum of five families. The file states it does not claim one agent per channel; sourcing runs through the Talent Discovery Agent. Channels are chosen per role and nothing is sent until a person approves.

| Channel family | Channels | Status | Described at |
| --- | --- | --- | --- |
| Digital and professional networks | 4 | Human-assisted: chosen per role, approved before use | `/how-it-works` |
| Direct and proprietary reach | 4 | Human-assisted | `/how-it-works` |
| AI and intent intelligence | 3 | Human-assisted | `/how-it-works` |
| Inbound and employer brand | 4 | Human-assisted per the code; the job board at `/jobs` publishes roles, but which employer-brand channels run is Unknown | `/how-it-works`, `/jobs` |
| Partnerships and offline | 8 | Human-assisted (partners, campuses, events, phone, press) | `/how-it-works` |

Owner verified for every row above: Unknown. Whether each channel was actually used for a customer search is Unknown; the repository does not record it.

## Cross-cutting capabilities (`offer-facts.ts` and related)

| Capability | Status | Public wording | Owner verified |
| --- | --- | --- | --- |
| Recruiter reviews every shortlist before the customer sees it | Human-assisted | "A recruiter reviews every shortlist before you see it" (`WHO_RUNS_THE_SEARCH`) | Unknown |
| Ranked shortlist of up to 10 candidates with evidence per score | Live | `SHORTLIST_LABEL` | Unknown |
| First shortlist timing | Claim | "usually arrives within 5 business days of an approved role brief ... It is not a guarantee" | Unknown |
| CV and job description uploads | Live | "PDF, DOCX, TXT or RTF" (`ACCEPTED_UPLOADS`). The agent registry in `src/lib/agents/registry.ts` still says "PDF only" and is rewritten at display time. | Unknown |
| Candidate record export | Live (claim) | "You can export your candidate records at any time" (`RECORDS_NOTE`); one-off package workspace access lasts three months | Unknown |
| SSO | Unknown. The pricing entitlement table lists "Included + SSO and security review" for Enterprise (`src/config/pricing-entitlements.ts:179`); the FAQ says access controls are agreed on a call; no SSO connector is listed in the integrations directory. | `/pricing`, `/faq` | Unknown |
| SOC 2, ISO 27001, HIPAA, full GDPR/CCPA/PDPL compliance | Unavailable: explicitly not claimed (`COMPLIANCE_NOTE`) | `/security` | Unknown |
| Online checkout | Unavailable | `/integrations`, `/pricing` | Unknown |
| WhatsApp outreach (Brazil, Gulf) | Unknown. WhatsApp is mentioned in `src/components/marketing/how-it-works-deep.tsx`; no number or connector is documented in the config files read. | `/how-it-works` | Unknown |
