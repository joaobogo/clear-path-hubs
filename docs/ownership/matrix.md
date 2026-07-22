# Ownership Matrix

Owner **type**, not person — assign named on-calls in the team roster.

| Domain               | Primary owner        | Escalation              |
| -------------------- | -------------------- | ----------------------- |
| Intake               | Product Ops          | Engineering             |
| Job board            | Product              | Engineering             |
| Applications         | Product Ops          | Engineering             |
| Processing           | Data / Processing    | Engineering             |
| Scoring              | Scoring team         | Engineering + Product   |
| Admin dashboard      | Product Ops          | Engineering             |
| Client dashboard     | Product              | Engineering             |
| Candidate dashboard  | Product              | Engineering             |
| Notifications        | Engineering          | Product                 |
| Security             | Security             | CTO                     |
| Database             | Engineering (DBA)    | CTO                     |
| Release management   | Engineering (Release)| CTO                     |
| Governance / DSR     | Legal + Security     | CTO                     |
| Cost / capacity      | Engineering          | CTO                     |
| Support ops          | Support lead         | Security                |

## Escalation ladders

- **Product / operational**: on-call ops → Product Ops lead → Product Director.
- **Engineering**: on-call engineer → Engineering lead → CTO.
- **Security**: on-call security → Security lead → CTO → Legal (if PII/regulatory).
- **Provider outage**: on-call engineer runs runbook 10 → CTO if > 30 min.

Every escalation MUST carry a `trace_id` from `trace_index`.
