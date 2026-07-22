# Deployment

- Preview: every push to a branch builds a preview on `project--<id>-dev.lovable.app`.
- Production: `preview_ui--publish` promotes preview to `project--<id>.lovable.app` (+ any custom domains).
- Migrations run automatically before the app boots on production.
- Rollback: previous published build is one click; DB is forward-only (see runbook 14).

**Blocked today**: production publishing is deferred until Phase 17 P1/P3/BG-02 clear.
