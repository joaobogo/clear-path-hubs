# Admin Runbook Index

Every runbook is stored below and follows the same template:

**Sections** — Symptoms · Diagnosis · Safe Action · Expected Result · Escalation · Rollback · Audit.

**Escalation ladder:** Level 1 = on-call ops · Level 2 = platform admin · Level 3 = engineering on-call · Level 4 = CTO. All escalations reference a `trace_id` from `trace_index`.

| # | Runbook                          | File                                   | On-call domain     |
| - | -------------------------------- | -------------------------------------- | ------------------ |
| 1 | Failed intake                    | `01-failed-intake.md`                  | Product Ops        |
| 2 | Failed CV parse                  | `02-failed-cv-parse.md`                | Processing         |
| 3 | OCR required                     | `03-ocr-required.md`                   | Processing         |
| 4 | Enrichment failure               | `04-enrichment-failure.md`             | Processing         |
| 5 | Scoring failure                  | `05-scoring-failure.md`                | Scoring            |
| 6 | Missing evidence                 | `06-missing-evidence.md`               | Scoring            |
| 7 | Candidate publication blocker    | `07-publication-blocker.md`            | Product Ops        |
| 8 | Wrong client visibility          | `08-wrong-client-visibility.md`        | Security           |
| 9 | Duplicate candidate              | `09-duplicate-candidate.md`            | Product Ops        |
|10 | Provider outage (LLM / email)    | `10-provider-outage.md`                | Engineering        |
|11 | Email failure                    | `11-email-failure.md`                  | Engineering        |
|12 | Realtime failure                 | `12-realtime-failure.md`               | Engineering        |
|13 | User access issue                | `13-user-access-issue.md`              | Security + Support |
|14 | Migration issue                  | `14-migration-issue.md`                | Engineering        |
