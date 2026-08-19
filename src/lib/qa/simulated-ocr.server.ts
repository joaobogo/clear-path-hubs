/**
 * Test-mode OCR simulation text.
 *
 * The e2e smoke journey uploads a real PDF, but no OCR runner exists in the
 * test environment, so a scanned/text-layer-less CV parks the match on
 * `ocr_required` and everything downstream (admin review, approval, client
 * publication) becomes unreachable. Test mode injects this text as if an OCR
 * pass had returned it, so the rest of the pipeline (enrich → score) runs for
 * real against realistic content.
 *
 * Server-only: never imported by client code.
 */

export const SIMULATED_OCR_CV_TEXT = [
  "MARIA QA CANDIDATE",
  "Lisbon, Portugal | +351 912 345 678 | qa.candidate@qa.taasflow.test",
  "",
  "SUMMARY",
  "Operations and delivery specialist with eight years of experience running",
  "guest-facing and back-office teams across hospitality and shared-service",
  "environments. Comfortable owning rotas, service levels and escalations, and",
  "used to reporting weekly performance to senior stakeholders.",
  "",
  "EXPERIENCE",
  "Operations Manager — Northwind Hospitality Group, Lisbon (2021 - present)",
  "- Led a team of 24 across front desk, reservations and guest relations.",
  "- Rebuilt the shift planning process, cutting unplanned overtime by 18%.",
  "- Owned the escalation queue and reduced average resolution time to 6 hours.",
  "- Ran onboarding for 40+ seasonal hires per year, including compliance checks.",
  "",
  "Team Lead, Guest Services — Arcadia Resorts, Faro (2018 - 2021)",
  "- Supervised a 12-person team over a three-shift pattern.",
  "- Introduced a daily handover briefing that lifted satisfaction scores.",
  "- Coordinated with housekeeping and maintenance on room readiness targets.",
  "",
  "Guest Services Agent — Arcadia Resorts, Faro (2016 - 2018)",
  "- Handled check-in, billing disputes and multilingual guest correspondence.",
  "",
  "EDUCATION",
  "BSc Tourism and Hospitality Management — Universidade de Lisboa, 2016",
  "",
  "SKILLS",
  "Team leadership, workforce planning, service-level reporting, escalation",
  "handling, onboarding and training, Opera PMS, Salesforce Service Cloud,",
  "Excel/Sheets modelling, process documentation.",
  "",
  "LANGUAGES",
  "Portuguese (native), English (fluent, C1), Spanish (professional, B2)",
  "",
  "WORK AUTHORISATION",
  "EU citizen — no sponsorship required. Available at four weeks' notice.",
].join("\n");
