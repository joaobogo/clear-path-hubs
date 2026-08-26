# TaasFlow

TAASFLOW GREENFIELD REBUILD — PHASE 1

PRODUCT, ARCHITECTURE, AND IMPLEMENTATION BLUEPRINT

We are rebuilding TaaSFlow from scratch from the functional and dashboard perspective.

This must be a genuinely new system.

Do not copy the existing application architecture.

Do not import legacy routes, legacy components, legacy tables, legacy functions, or legacy technical debt.

Do not modify the existing production platform.

Create a new repository, new Supabase project, new deployment environment and new database schema.

The existing platform may be inspected only to understand validated business requirements and desired behavior.

The first version must focus only on:

1. Client intake

2. Position management

3. Public job board

4. Candidate application and CV submission

5. CV parsing and scoring

6. Admin dashboard

7. Client dashboard

8. Candidate dashboard

9. Candidate review and publication

10. Client candidate decisions

11. Messages and notifications

12. Security, auditability and testing

Do not build yet:

- blog

- resource centre

- complex marketing pages

- Executive View

- sourcing-hours-saved KPI

- recruiter-workweeks KPI

- speculative AI features

- multiple overlapping admin consoles

- advanced campaign management

- unrelated analytics

────────────────────────────────────────

PRODUCT PRINCIPLES

────────────────────────────────────────

The new system must follow these principles:

1. One source of truth per business entity.

2. One canonical write path per mutation.

3. Exact IDs, never title-based or name-based matching.

4. One screen should support one clear user decision.

5. Every score must have evidence.

6. Admin approval before client visibility.

7. Client views must use sanitized client-safe data.

8. Every button must perform the action it describes.

9. Every success must be confirmed by the backend.

10. Every important action must be auditable.

11. Desktop and mobile must be usable.

12. Simplicity is more important than adding features.

────────────────────────────────────────

PRIMARY PERSONAS

────────────────────────────────────────

Admin:

- manages clients

- manages positions

- reviews candidate processing

- reviews scores and evidence

- edits candidate and position information

- previews what clients will see

- approves candidates for clients

- repairs processing failures

- audits activity

Client:

- completes intake

- creates and reviews positions

- sees candidate-focused KPIs

- uses a position and candidate Kanban

- reviews candidates

- shortlists

- rejects

- requests interviews

- provides feedback

- communicates with TaaSFlow

Candidate:

- browses jobs

- applies

- uploads a CV

- answers screening questions

- tracks applications

- updates profile and CV

- receives candidate-safe updates

- communicates when needed

────────────────────────────────────────

DESIRED PRODUCT STRUCTURE

────────────────────────────────────────

Public:

- Home shell

- Jobs

- Job detail

- Client intake

- Candidate application

- Login

- Legal pages

Admin:

- Overview / Work Inbox

- Clients and Positions

- Candidates

- Publish Desk

- Pipeline Health

- Settings

Client:

- Overview

- Positions

- Candidates

- Messages

- Team

- Settings

Candidate:

- Applications

- Profile

- Messages

- Settings

────────────────────────────────────────

TECHNICAL DIRECTION

────────────────────────────────────────

Use:

- React and TypeScript

- a clean route architecture

- Supabase Postgres

- Supabase Auth

- Supabase Storage

- Edge Functions only where server-side processing is required

- Row Level Security

- a shared design system

- Zod or equivalent runtime validation

- canonical service modules

- Playwright for end-to-end testing

- unit and integration tests

- structured logging and trace IDs

Do not put business rules directly inside visual components.

Separate:

- domain logic

- database access

- permissions

- presentation

- background processing

- audit logging

────────────────────────────────────────

REQUIRED OUTPUT

────────────────────────────────────────

Create a detailed architecture proposal containing:

- route map

- persona map

- domain boundaries

- database entity map

- service boundaries

- write-path inventory

- permission model

- scoring workflow

- candidate publication workflow

- notification workflow

- testing strategy

- deployment strategy

- implementation sequence

- risks

- explicit features excluded from version one

Do not begin building the dashboards in this phase.

Return:

- new repository name

- new Supabase project plan

- proposed folder structure

- proposed database structure

- proposed route structure

- implementation phases

- architecture risks

- PASS or FAIL

PASS requires a complete, internally consistent greenfield plan.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://clear-path-hubs.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1dc5ee7e-1294-441c-8288-850e79e443f6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
