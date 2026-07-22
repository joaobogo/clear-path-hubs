# Events

Domain events land in `notification_events` and fan out via triggers/hooks to `notifications`, `notification_deliveries`, and Supabase Realtime channels.

## Canonical event catalog

| Event                          | Source                    | Consumers                                      |
| ------------------------------ | ------------------------- | ---------------------------------------------- |
| `intake.submitted`             | `submitIntake`            | admin queue                                    |
| `position.activated`           | `activatePosition`        | client (email), job board cache invalidate     |
| `application.received`         | `submitApplication`       | candidate (email), admin queue                 |
| `processing.state_changed`     | processing pipeline       | admin queue, candidate my-apps                 |
| `match.scored`                 | scoring engine            | admin publish desk                             |
| `match.delivered`              | `publishCandidate`        | client (email + in-app)                        |
| `match.stage_changed`          | `moveMatchStage`          | client Kanban, candidate my-apps, admin        |
| `interview.scheduled`          | `scheduleInterview`       | candidate, client, admin                       |
| `message.sent`                 | `sendMessage`             | recipient(s) in-app, digest email              |
| `support.view_as_start/end`    | support module            | target user (in-app)                           |
| `dsr.received/fulfilled`       | governance                | staff, subject                                 |
| `provider.circuit_breaker`     | `setProviderCircuitBreaker` | admin `/status`                              |

Realtime channels: `org:<orgId>` (Kanban), `thread:<threadId>` (chat), `user:<userId>` (bell), `admin:overview` (queue).
