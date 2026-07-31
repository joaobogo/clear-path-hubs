# Admin experience audit — where operators leave the screen, guess, or repeat themselves

Walked the operator path: sign in → overview → intake → positions → candidates →
review → payments → messages. Below is what was actually wrong, worst first, and
what changed.

## The worst ten (all fixed in this pass)

1. **The overview was a report, not a queue.** Counts with no direct action, so
   every shift started by hunting through lists.
   → `/admin` is now a work queue: unpaid submissions, roles awaiting setup,
   candidates awaiting review, overdue client decisions, interviews to
   coordinate, and blocked processing — each with a real count and one action
   per row.
2. **Candidate review took four screens.** Evidence on one tab, CV via a
   download, requirements on the role page, decision at the bottom.
   → `/admin/review/$matchId` puts evidence, an inline CV preview, the role's
   requirements and the decision bar on one screen.
3. **Downloading a CV to read it.** Every review meant a file download and an
   external PDF viewer.
   → Signed URL rendered in an inline iframe, "open in new tab" kept as escape.
4. **Back to the list after every decision.** Reviewers re-found their place
   dozens of times a day.
   → The review screen holds an ordered queue and advances to the next
   candidate automatically after approve/hold/reject.
5. **Mouse-only repetition.** Three clicks per decision.
   → Keyboard: `A` approve, `H` hold, `R` reject, `C` note, `J`/`K` next and
   previous.
6. **"How long has this been waiting?" was a mental calculation.**
   → Every queue row shows the wait (`4h`, `3d`) and colours it once it passes
   the tolerance for that queue.
7. **Overdue client decisions were invisible.** Nothing surfaced candidates
   shared days ago with no answer.
   → Dedicated queue: shared, visible, three days old, no decision recorded.
8. **Abandoned checkouts were untracked.** Operators only saw successful
   payments, so a stalled buyer was silent.
   → Payments page now separates "who paid" from "abandoned before payment",
   distinguishing checkout-started from never-started.
9. **Pilot state lived in the database only.** No screen answered "who is on a
   pilot and when does it end?"
   → Pilot panel with status, linked role, admin override and days remaining.
10. **Processing incidents were buried in operations.** Parse/OCR/provider
    failures blocked candidates without appearing on the operator's path.
    → Blocked-in-processing queue on the overview with a direct fix link.

## Rules kept

- Real records only. No estimates, no sample rows, no placeholder pilots.
- Counts come from exact `count: "exact"` queries, not page lengths.
- Every action link resolves to an existing route; nothing opens a dead end.
- Staff gating is server-side (`is_platform_staff`) inside every server
  function, not enforced in the UI.
