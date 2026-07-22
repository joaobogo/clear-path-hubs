# Phase 01 — Route Comparison

Working-status columns are **based on source inspection only** for the original project (this workspace cannot exercise `sourcing-suite-ai.lovable.app` deep links here) and on prior Playwright audits + source inspection for the new project. Live-browser re-verification is Phase 2 work.

## Original project routes (Talent Streamline) — from `src/App.tsx`

### Public marketing
| Route | Component | Auth | Src-inspection status |
|---|---|---|---|
| `/` | `Index` | none | present |
| `/how-it-works` | `HowItWorks` | none | present |
| `/taasflow-journey` | `Journey` | none | present |
| `/journey` | 301 → `/taasflow-journey` | none | redirect |
| `/about` | `About` | none | present |
| `/pricing` | `Pricing` | none | present |
| `/enterprise` | `Enterprise` | none | present |
| `/pilot` | `PilotOverview` | none | present |
| `/pilot-legacy` | `Pilot` | none | **deprecated** |
| `/faq` | `FAQ` | none | present |
| `/contact` | `Contact` | none | present |
| `/resources` | `Resources` | none | present |
| `/case-studies` | `CaseStudies` | none | present |
| `/industries` | `Industries` | none | present |
| `/industries/compare` | `IndustryComparison` | none | present |
| `/industries/{tech,legal,public-sector,finance,staffing-agencies,healthcare,sales,marketing,human-resources,accounting,real-estate,saas,ecommerce,insurance,construction,hospitality,media,non-profit,private-equity,cybersecurity,data-analytics,consulting}` (22) | industry pages | none | present |
| `/partnerships/staffing` | `StaffingPartnership` | none | present |
| `/talent` | `TalentMarketplace` | none | present |
| `/talent-network` | `TalentNetwork` | none | present |
| `/global-talent` | `GlobalTalent` | none | present |
| `/employer-onboarding` | `EmployerOnboarding` | none | present |
| `/candidate-success` | `CandidateSuccess` | none | present |
| `/knowledge-base` | `KnowledgeBase` | none | present |
| `/dashboard-preview` | `DashboardPreview` | none | present |
| `/subscribe/:planId` | redirect → `/pilot/intake?plan=...` | none | redirect |
| `/candidates` | 301 → `/talent-network` | none | redirect |
| `/join-network` | 301 → `/talent-network` | none | redirect |
| `/prime-global-analytics` | 301 → `/dashboard/client` | none | redirect |

### Blog / resources
| `/blog` | `Blog` | none | present |
| `/blog/category/:category` | `BlogCategory` | none | present |
| `/blog/:slug` | `BlogPost` | none | present |

### Legal
| `/privacy` | `PrivacyPolicy` | none | present |
| `/terms` | `TermsOfService` | none | present |

### Employer intake
| `/pilot/overview` (`/pilot`) | `PilotOverview` | none | present |
| `/pilot/intake` | `PilotIntake` (6-step) | anon OK (server provisions) | present, complex (2027 lines) |
| `/pilot/confirmation` | `PilotConfirmation` | none | present |

### Job Board
| `/jobs` | `JobsPage` (lazy-with-retry) | none | present |
| `/jobs/:id` | `JobDetailPage` | none | present |

### Candidate
| `/candidate/join` | `CandidateJoin` | none | present |
| `/candidate/login` | `CandidateAuth` | none | present |
| `/candidate/dashboard` | `CandidateUnavailable` | none | **gated placeholder** |
| `/candidate/profile` | `CandidateUnavailable` | none | **gated placeholder** |
| `/candidate/messages` | `CandidateUnavailable` | none | **gated placeholder** |
| `/candidate/replace-cv` | `ReplaceCv` | link+token | present |
| `/talent/:slug` | `PublicProfile` | none | present |
| `/applications/track/:applicationId` | `ApplicationTracker` | link+token | present |

### Auth / errors
| `/reset-password` | `ResetPassword` | none | present |
| `/unauthorized` | `Unauthorized` | none | present |
| `/access-denied` | `AccessDenied` | none | present |
| `*` | `NotFound` | none | present |

### Admin (all `GatedAdminModule`)
| `/dashboard/admin` | `AdminDashboard` |
| `/dashboard/admin/overview,intakes,candidates,jobs,clients,scoring,repair,qa` | routes/*.tsx |
| `/dashboard/admin/incidents,requisitions,publish,pipeline-health` | 4 consolidated surfaces |
| `/dashboard/admin/integrity,anomalies,application-flow-monitor,processing-monitor,processing-sla,application-recovery,application-link-repairs,tracking-diagnostics` | 301 → incidents (query pre-selects tab) |
| `/dashboard/admin/scoring-proposals,batch-score-review,visibility-audit,danger-band-review,credibility-review` | 301 → publish |
| `/dashboard/admin/application-scoring-health` | 301 → requisitions |
| `/dashboard/admin/data-hygiene,system-health,email-delivery-drilldown,notification-delivery` | 301 → pipeline-health |
| `/dashboard/admin/reparse-workflow,prime-global-review-queue,manual-scoring-queue,score-band-qa` | specialty surfaces |
| `/dashboard/admin/campaigns/prime-global{,/test-send,/history,/qa,/send}` | Prime Global campaign flows |
| `/dashboard/admin/search-filter-sort-audit` | audit tool |
| `/dashboard/admin/qa/{client-preview/:tenantId, candidate-preview/:submissionId, job-apply-preview/:jobId, intake-preview}` | admin-only QA previews |
| `/dashboard/admin/prime-global/analytics-preview` | placeholder (analytics removed) |

### Client (`ProtectedRoute` role=client)
| `/dashboard/client` | → `/dashboard/client/overview` (preserves query) |
| `/dashboard/client/:section` | `ClientDashboard` (overview, positions, candidates, kanban, messages, team, settings, etc.) |
| `/dashboard/client/executive` | 301 → overview |
| `/dashboard/client/talent` | `ClientTalentDatabase` |

### Legacy locale
`{ar,es,fr,de,nl,it,pt,da,ko,ja}/*` — all redirect to English canonical (10 prefixes). All other unknown first segments fall through to `NotFound`.

### Internal QA
`/dev/intake-harness` → `IntakeShellHarness`.

---

## New project routes (Clear Path Hubs) — from `src/routes/`

### Public
| Route | File | Purpose | Status |
|---|---|---|---|
| `/` | `index.tsx` | landing | present (basic) |
| `/auth` | `auth.tsx` | Supabase Auth | present, PASS in prior Playwright |
| `/login` | `login.tsx` | login | present |
| `/reset-password` | `reset-password.tsx` | password reset | present |
| `/access-denied` | `access-denied.tsx` | 403 | present |
| `/intake` | `intake.tsx` | 5-step client intake | present, PASS |
| `/intake/confirmation` (route file `intake_.confirmation.tsx`) | confirmation | present |
| `/jobs` | `jobs.index.tsx` | Job Board | present, PASS |
| `/jobs/$id` | `jobs.$id.index.tsx` | Job Detail | present, PASS |
| `/jobs/$id/apply` | `jobs.$id.apply.tsx` | Candidate Application (CV upload) | present, PASS |
| `/apply/received/$applicationId` | `apply.received.$applicationId.tsx` | Thank-you + reference id | present, PASS |
| `/dev/catalogue` | `dev.catalogue.tsx` | design-system catalogue | present |

### Server routes (API)
`POST /api/public/intake`, `GET /api/public/intake-status/$id`, `POST /api/public/pipeline.run`, `POST /api/public/qa-seed`, `POST /api/public/bootstrap-admin`.

### `_authenticated/` (SSR off; `route.tsx` gates via `supabase.auth.getUser()`)
Admin: `/admin`, `/admin/candidates`, `/admin/candidates/$id`, `/admin/clients`, `/admin/clients/$id`, `/admin/clients_new`, `/admin/positions`, `/admin/positions/$id`, `/admin/publish`, `/admin/notifications`, `/admin/health`, `/admin/team`, `/admin/settings`.
Client: `/client`, `/client/candidates`, `/client/candidates/$id`, `/client/positions`, `/client/positions/$id` (Kanban), `/client/messages`, `/client/team`, `/client/settings`.
Candidate: `/me`, `/me/applications`, `/me/applications/$id`, `/me/messages`, `/me/profile`, `/me/settings`.

### Coverage of "must-exist" list
| Required | Present? |
|---|---|
| Admin login | ✅ `/auth`, `/login` |
| Client login | ✅ (same) |
| Admin Overview | ✅ `/admin` |
| Admin Clients | ✅ `/admin/clients` |
| Admin Client Detail | ✅ `/admin/clients/$id` |
| Admin Positions | ✅ `/admin/positions` |
| Admin Candidates | ✅ `/admin/candidates` |
| Candidate Detail (admin) | ✅ `/admin/candidates/$id` + universal drawer |
| Client Overview | ✅ `/client` |
| Client Positions | ✅ `/client/positions` |
| Client Candidates | ✅ `/client/candidates` |
| Client Candidate Detail | ✅ `/client/candidates/$id` |
| Client Kanban | ✅ inside `/client/positions/$id` |
| Client Messages | ✅ `/client/messages` |
| Client Team | ✅ `/client/team` |
| Client Settings | ✅ `/client/settings` |
| Candidate Dashboard | ✅ `/me` |
| Job Board | ✅ `/jobs` |
| Job Detail | ✅ `/jobs/$id` |
| Candidate Application | ✅ `/jobs/$id/apply` |
| Client Intake | ✅ `/intake` |
| Application Tracking | ✅ `/me/applications/$id` (+ `/apply/received/$applicationId`) |

## Missing from new project
- All 22 industry pages
- Blog + BlogCategory + BlogPost
- About / Pricing / Enterprise / Contact / FAQ / Resources / Case Studies / Journey / Knowledge Base
- Talent Marketplace / Talent Network / Global Talent / Public Profile (`/talent/:slug`)
- Employer Onboarding / Candidate Success / Staffing Partnership
- Legal (`/privacy`, `/terms`)
- Public application tracker (`/applications/track/:id`) — new has authenticated variant only
- Dashboard Preview, Knowledge Base, i18n
- Sitemaps, robots.txt, og-image, brand assets
