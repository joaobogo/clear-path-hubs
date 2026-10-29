# Claude second review: run log

One entry per run. Procedure: `docs/ops/second-review-runbook.md`.

## 29 Oct 2026, first run (manual, before the schedule started)

Positions: Group Marketing Manager (Stratium Partners), Mushroom Harvesting
Manager (Hughes Mushrooms).

Database
- Eligibility recompute applied across all positions: 18 matches restored
  from not_eligible to eligible (17 Group Marketing Manager, 1 Mushroom
  Harvesting Manager), each with an `eligibility_recomputed` audit row; 9
  missing failed-check records written for real dealbreaker exclusions on
  three other roles. A second run changes nothing.
- Hughes, on the owner's instructions (Recruiter review 29 Oct 2026):
  Chiedza Chaya's briefing corrected (sponsorship removed as a weakness,
  first paragraph replaced, highlights dated), review note, manual override
  25 attributed to the owner; passport and permit numbers, date of birth,
  religion, gender, marital status and home address removed from the
  extracted CV text, the stored score run text and three audit-history
  copies (the uploaded CV file is unchanged; the score is unchanged).
- Daim Shah: the "no dated employment" flag was wrong (five dated roles
  under "Career Overview"); blocking note corrected, a correction note
  supersedes the re-upload request. No email sent.

Second review
- All 32 Group Marketing Manager candidates reviewed by four reviewers and
  checked by the final reviewer; one internal note each and one admin task
  with the ranked proposed scores. Final reviewer changed one call: Kumar
  Sambhav Verma's target-market requirement is met (regional remit including
  Singapore), proposed 85.
- Web research: Firecrawl had no credits; standard web search was used.
  Some trade-press sites are outside the session's network allowlist.

Code (merged to main)
- v1.7.1: market experience for any country; protected-attribute criteria
  blocked at intake, role edit and publish with suggested rewrites;
  requirement changes queue a rescore; thin CVs get one re-read and an
  admin task; scoring guardrails card on data health.
- v1.7.2: degree subject read from its own words; stated tenure that dated
  roles contradict is partial; education dates judged at the range;
  letter-spaced PDF text rebuilt; "Career Overview" counts as work history.

Open
- Lovable's GitHub sync is off (since 27 Oct). Until the owner reconnects
  it, Lovable runs engine v1.5.4 and the rescore must wait.
- Owner decision: weight of the key market requirement (see the task).
