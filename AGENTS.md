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
