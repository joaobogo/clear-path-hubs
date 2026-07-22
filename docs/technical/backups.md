# Backups and Rollback

## Backups

- **Postgres**: managed daily backup + PITR (Lovable Cloud managed). Full export available via Cloud → Advanced settings → Export data.
- **Storage (`cvs` bucket)**: versioned; deletes are soft (see governance retention).
- **App build artifacts**: previous published build retained; rollback is one click.

## Rollback matrix

| Change kind                        | Rollback                                                    |
| ---------------------------------- | ----------------------------------------------------------- |
| App code                           | Republish previous build                                    |
| Schema migration                   | Forward-fix compensating migration (see runbook 14)         |
| Data (accidental delete/update)    | PITR restore via Level 4 approval; freeze writes first      |
| Provider outage / cost spike       | Circuit breaker (`setProviderCircuitBreaker`, runbook 10)   |
| Wrong publication                  | `unpublishMatch`                                             |
| Wrong merge                        | `unmergeCandidateProfiles` within 24 h                      |

**PITR is a last resort.** Every action that could require PITR must first freeze writes via `setMaintenanceMode(true, reason)`.
