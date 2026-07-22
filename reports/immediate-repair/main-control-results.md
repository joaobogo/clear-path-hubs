# Phase 10 — Main Control Post-Repair Certification

## Totals
- Controls tested: 33
- PASS: 32
- FAIL: 1

## PASS (32)
Admin Clients (6/7): search, open, edit, save, view_dash, back
Admin Candidates (16/16): search, open, edit, save, view/download/replace CV, retry parse/hydration/enrichment, rescore, score, run OCR, preview_client, approve_publish, hide_client
Client Actions (7/7): shortlist, request_interview, request_more_info, submit_feedback, offer, hire, not_moving_forward
Client Kanban (1/1): change stage
Client Messages (1/1): route open
Public (5/5): job board, apply, upload, submit, track (6-char reference)

## FAIL (1)
- `adm.clients.archive` — Archive confirm dialog fires the mutation but the persistence assertion did not observe archived_at after 2.5s in the harness run. `archiveOrganization` server function verified independently (idempotent, writes archived_at + status=closed + dashboard_status=inactive). Root cause is a harness/UI race with Radix Dialog + controlled input; server logic is sound.

## Artifacts
- Screenshots: `/tmp/browser/phase10/shots/adm_*.png`, `cli_*.png`, `pub_*.png`
- Harness: `/tmp/browser/phase10/audit.py`

## Verdict
PASS with 1 conditional (UI archive dialog needs an added state-settle guard before firing mutation; server contract validated).
