# Hughes Mushrooms: Mushroom Harvesting Manager review (29 Oct 2026)

Two candidates, plus four platform fixes. The record edits need database
access, so they are written as one prompt for Lovable (Prompt H1). Lovable
shows before/after and waits for "go". The platform fixes (H2) are a proposal
and are not applied until the owner says OK.

This file contains no candidate contact details or personal identifiers.
Records are found by application ID prefix.

## What the code shows

- **Sponsorship.** The insights step (`src/lib/pipeline-runner.server.ts`,
  `loadCtx`) loads the position as `id,status,requirements,
  preferred_requirements,title,description` only. `work_authorization` is
  never loaded, so the model writing the Honest read does not know that the
  employer sponsors visas. To the model, "needs a UK visa" looks like a gap.
  That is how "Requires UK Visa Sponsorship" got into the shortfalls.
- **Personal data.** The full CV text goes to the insights model as it is.
  The client CV preview (`src/lib/cv-redactor.server.ts`) only removes contact
  lines (`stripContactLines`). Nothing masks passport, permit or ID numbers,
  date of birth, religion or home address, so any of these can be copied into
  a quote, a strength or a summary.
- **Criteria version.** Each score run stores `rubric_version_id`. Criteria
  live in `rubric_versions` (`version_number`, `status`, `snapshot`), and the
  position text lives in `position_versions`. Lovable can read the current
  version and compare it with the version each candidate's current run used.

## Prompt H1: record edits (paste into Lovable)

```
Hughes Mushrooms, position "Mushroom Harvesting Manager". Two candidates.
Rules for the whole task:
- Find each record and confirm it to me first (name, application ID, current
  score, verdict, status). Then show me a before/after table for every field
  you would change. Do not write anything until I reply "go".
- Never approve a score, publish, or change client visibility.
- Log every change in History & Audit with the reason
  "Recruiter review 29 Oct 2026", with the old and new value of each field.
- Do not print passport, permit or ID numbers, date of birth, religion or
  home address in chat, notes, audit entries or anywhere else. To say where
  one appears, give the table and field name only.

CANDIDATE 1: Chiedza Chaya, application ID starts 979e443e.
Now: 52 "Consider", AI read "reject". Decision: do not advance.
1. Shortfalls: delete the item "Requires UK Visa Sponsorship".
2. Honest read paragraph 1 (pitch_summary): replace it with exactly:
   "Chiedza Chaya has broad general farming experience in Zimbabwe and South
   Africa, across poultry, pigs, crops, nursery work and aquaponics. Her CV
   does not include any mushroom growing or picking, which is the core
   requirement for this role, and this does not match her screening answer.
   She is not a fit for this position."
3. Honest read paragraphs 2 and 3 (narrative): delete every sentence that
   treats visa sponsorship as a negative. Change nothing else. Show me the
   sentences you delete.
4. Highlights: replace
   "Supervised 100 farm workers on crop and animal sections at Rowena Farm,
   reporting to the General Manager"
   with
   "Supervised 100 farm workers on the crop and animal sections at Rowena
   Farm (2006-2007), reporting to the General Manager"
   and replace
   "Managed 30 foremen and 200 workers at Linders' Piggery and Poultry Farm"
   with
   "Managed 30 foremen and 200 workers at Linders' Piggery and Poultry Farm
   (Nov 2004 - Jan 2005)".
   (The CV dates are Sep 2006 - Aug 2007 and Nov 2004 - Jan 2005.)
5. Personal data: her CV contains a passport number, permit number, date of
   birth, religion and home address. Search every place this candidate's
   data is stored outside the original CV file: candidate_profiles (all
   columns, including skills/experience JSON), parsed or extracted CV text,
   candidate_insights JSON, score run evidence and quotes, client preview or
   redacted CV text, exports, notes. Report table + field for each hit
   (not the value). After "go", remove or mask each one. Leave the original
   uploaded file alone.
6. Review notes: "Decline for this role. Screening answer on mushroom
   experience is not supported by the CV. Large-team supervision is dated
   (2004-2007); 2011-2020 self-employed fruit and veg trading; recent roles
   3-16 months. Talent pool: general farm or aquaculture supervisor roles."
7. Manual override score 25, reason: "No mushroom picking or mushroom-farm
   supervision on the CV; screening answer not supported."
   Write it as a human-adjusted score run (evaluation_method
   'human_adjusted') and point current_score_run_id at it, so the admin
   page, list, KPI and any export show 25. Do not approve it.
   Set the verdict badge to "Recruiter read: Reject"
   (overall_recommendation "reject", recommendation_source "recruiter",
   confidence null), so the badge and the score agree.
8. Do not send anything to her. The decline email is drafted separately.

CANDIDATE 2: Daim Shah, application ID starts 53d87449.
Now: "manual review required" (no dated roles on the CV).
Decision: cannot assess yet. Do not score him and do not reject him.
1. Keep status "manual review required". Blocking note:
   "Awaiting a complete CV with dated roles."
2. Show me the exact text the platform extracted from his uploaded CV, word
   for word, in a code block. Do not summarise it.
3. Review notes: "CV lacks dated roles; complete CV requested 29 Oct 2026."
4. Do not send anything to him. The email is drafted separately.

POSITION CHECKS (read only, report back):
A. Show the criteria for this position: every rubric_versions row
   (version_number, status, label, created_at, approved_at) and the full
   requirements text of the active version. Also the latest
   position_versions row (version_number, requirements, dealbreakers).
B. For every candidate on this position: name, application ID prefix,
   current score, and the rubric version_number their current run used.
   Flag anyone scored on a version older than the active one.
C. For every candidate on this position, list any shortfall, concern or
   Honest read sentence that mentions visa, sponsorship, work permit or
   right to work. Do not change them yet; I will confirm after H2.
D. Show the position's work_authorization JSON so we can confirm
   sponsorship is recorded as offered.
```

## Email drafts (not sent)

**To Chiedza Chaya, subject: Your application for Mushroom Harvesting Manager**

> Dear Chiedza,
>
> Thank you for applying for the Mushroom Harvesting Manager role with
> Hughes Mushrooms, and for the time you put into your application.
>
> We have reviewed it carefully. This role needs hands-on experience in
> mushroom picking or supervising a mushroom-harvesting team, and we have
> decided not to take your application further for this position.
>
> Your farm supervision experience is broad, and we would like to keep your
> details on file for general farm or aquaculture supervisor roles, if you
> are happy for us to do so.
>
> Thank you again, and we wish you every success.
>
> Kind regards,
> TaaSFlow Recruitment, on behalf of Hughes Mushrooms

**To Daim Shah, subject: Your application for Mushroom Harvesting Manager: one more step**

> Hi Daim,
>
> Thank you for applying for the Mushroom Harvesting Manager role with
> Hughes Mushrooms.
>
> We would like to review your application properly, but the CV we received
> doesn't show your work history with dates. Could you re-upload your CV as
> a PDF, listing for each role:
>
> - your job title
> - the employer
> - start and end dates (month and year)
>
> Please include any roles on a mushroom farm, and any picking or harvesting
> supervision, even short ones. Those matter most for this position.
>
> Once we have it, we'll review your application straight away.
>
> Best regards,
> TaaSFlow Recruitment, on behalf of Hughes Mushrooms

## H2: platform fixes (proposal, not applied)

1. **Sponsorship is never a weakness when the role sponsors.**
   - Load `work_authorization` with the position in `loadCtx`, and pass
     `sponsorship_offered: boolean` into `generateCandidateInsights`.
   - Add a prompt line: when the employer sponsors visas, needing
     sponsorship is not a concern and is not mentioned.
   - Add a deterministic post-filter on the model's output, because a prompt
     alone can be ignored: when sponsorship is offered, drop concerns, and
     sentences in the pitch and narrative, that mention visa, sponsorship,
     work permit or right to work as a negative. Unit-tested.
   - Check screening questions: a "Do you need sponsorship?" question with a
     preferred answer of "No" must not count as a dealbreaker on a
     sponsoring role.
   - Clean up this position's existing records from check C in H1, with an
     audit entry per change.
2. **No nationality, citizenship, ethnicity or origin.** Same post-filter
   pattern: concerns and strengths that mention these (and religion and age)
   are removed, and the prompt says so. Lovable may already have added a
   rule for Stratium that is not yet on GitHub. Once it syncs, I'll check it
   and reuse it rather than adding a second one.
3. **Scored on current criteria.** From checks A and B in H1. Anyone on an
   old version gets a new score run on the active version (not approved).
   Chiedza's override of 25 stays on top.
4. **Mask personal identifiers at intake.** A new
   `src/lib/privacy/mask-identifiers.ts` that masks labelled values:
   passport, permit, visa, national ID and ID numbers; date of birth
   (DOB, born); religion; and home address lines. It runs on the extracted
   CV text before profile parsing, before the insights model, before
   evidence quotes, and in the client CV preview (`redactCv`). The original
   file is not changed. Masking is by label ("Passport No:", "Date of
   Birth:", "Religion:", "Address:"), so it doesn't eat ordinary text,
   and it has unit tests on CV shapes like this one. A one-off scan reports
   (table + field, no values) existing records that already hold such
   values.
