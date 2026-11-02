<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Role approval overrides use the authenticated caller's database client, not the privileged client, so the database can verify platform-admin permissions independently; activation and publishing retain their separate gates.
- Homepage chapter backgrounds extend across the viewport while content stays constrained, so the chapter rail does not leave a blank side gutter.
- Industry cards and detail pages use the shared hero-image registry and managed media pointers, so sector imagery stays consistent without third-party hotlinks.
- Public page photography uses shared image primitives with intrinsic dimensions and eager loading only above the fold, preserving stable layouts and accessible descriptions.
- Editorial covers use the shared cover primitive and buyer-page image registry; image motion never hides content and respects reduced motion.
- Public canvas motion caches its static frame and suspends when paused, offscreen, or in a hidden tab, so animation does not compete with reading or waste rendering work.
- Public sales forms capture Attio delivery through the persisted lead pipeline using the primary record ID; this prevents navigation loss and duplicate browser sends while excluding candidate and support records.
- Public product tours reuse the shared labelled example previews; tab changes are user-controlled and never write to live workspace data.
- Screening excludes protected-attribute criteria and requires dated employment evidence; chronology uses the assessment date, not model knowledge.
- Recruiter editorial corrections preserve immutable score runs and client-release gates and record field-level audit history.
- Incomplete CV assessments clear only the current ranking pointer; immutable runs remain in history, and recorded overrides resolve separately from automated totals without granting approval.
- PDF ingestion extracts URI annotations and attempts validated OCR once; failed document reads require explicit staff retry rather than automatic rebilling.
- CV text keeps its line structure from PDF extraction through protected-attribute filtering; text stored flattened is re-read from the original file, and the scorer reads any remaining long lines in segments.
- Eligibility is decided by dealbreaker answers and recruiter decisions only; answers to other questions are weighed by the scorer, and eligibility checks are stored in the table's passed/failed/unknown/excepted vocabulary. A recruiter decision (eligibility_checks recruiter_review:*) always wins in the engine, offline rescore and the database recompute: excepted or passed lifts that dealbreaker's disqualification (the answer is still a gap), failed makes the match not eligible. A dealbreaker "yes" the CV does not support is recorded for recruiters as an unverified screening claim; the candidate stays eligible and the client never sees recruiter-only wording.
- Requirement evidence excludes the role's own words (the client's name outside a dated work entry, the role title where the text is about this application, aspirational clauses), and study or training counts as partial at most for experience requirements.
- A dealbreaker screening question tests one requirement: a bundled dealbreaker is refused on every save path with a suggested split the author applies, never a silent rewrite.
- Parsed CV facts reach the profile additively (only empty, unlocked fields), and every certification reaches the client card.
- A CV the pipeline cannot score always has one open admin task, and dated roles above a detached work heading count as employment.
- Applications that arrive without the apply form (direct email, staff entry, applicant imports) can answer the role's screening questions from the status page; the link is emailed once, never to staff-assigned matches or retroactively, and late answers never replace a reviewed score.
- Market-experience rules read places from the shared geography dictionary and companies or brands from the brand-origin dictionary: marketing a brand from a market counts as experience of it wherever the work was done; nationalities, languages and demonyms describing a person never satisfy a market requirement, and an unnamed regional remit is partial.
- Hiring criteria pass the shared protected-attribute detector on every save path (intake, role editor, admin patch, publish, generated blueprints); a finding blocks the save with a suggested rewrite the author applies, never a silent rewrite.
- Criteria changes queue every match on the role for a full-pipeline rescore and notify admins without approving anything or changing client visibility; a candidate the pipeline cannot score always has an open admin task.
- One published score per candidate: the reviewed requirement verdicts are scored by the platform formula on a human-adjusted score run (apply_reviewed_verdicts), the admin list and the client workspace read that run, and an override decision that differs from its run is refused.
- An introduction video (Loom or Google Drive link on the match) adds 5 points automatically, capped by the 100 ceiling. Score runs never store it: every surface that shows, filters, sorts or exports a score folds it at read time through the published-score helpers (or the admin index view's published_score/published_band), so a video candidate shows one number everywhere.
