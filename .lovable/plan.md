# Plan: Staff Account Settings Implementation

Staff and client members are currently stranded on a bare `/me/settings` page because a route guard in `src/routes/_authenticated/me.tsx` blocks access to anyone without a `candidate_profile`. This plan will relax that guard and adapt the settings/profile pages to work for all authenticated users.

## User Review Required

> [!IMPORTANT]
> This change allows staff and client members to access the `/me` route subtree. While they won't see candidate-specific data (like CVs or job applications), they will be able to manage their personal profile (name, email, password) using the same UI as candidates.

## Proposed Changes

### 1. Route Guard Relaxation
- Modify `src/routes/_authenticated/me.tsx` to remove the hard redirect for non-candidates.
- Update the layout to gracefully handle the absence of a `candidate_profile` by showing only relevant navigation items (Home, Profile, Settings) and hiding candidate-specific ones (Applications, CV, Messages).

### 2. Profile Page Adaptation
- Update `src/routes/_authenticated/me.profile.tsx` to fetch data from the base `profiles` table instead of relying solely on `candidate_profiles`.
- Conditionally hide candidate-specific sections (Work Authorisation, Experience, Skills, Links) if the user is not a candidate.

### 3. Settings Page Adaptation
- Update `src/routes/_authenticated/me.settings.tsx` to handle the absence of candidate-specific consent fields.
- Ensure "Delete my account" and "Request my data" remain functional for all users as they pertain to the base `auth.users` / `profiles` records.

### 4. Admin Registry Alignment
- Update `src/routes/_authenticated/admin.settings.tsx` registry to reflect that these personal settings routes are now fully functional for staff.

## Technical Details

### Security and Authorization
- The `getMyContext` function in `src/lib/candidate.functions.ts` already returns a `seat` property ("candidate" | "client" | "staff"). We will use this to drive conditional UI.
- Personal data updates (full name) will target the `profiles` table, which is the canonical source for all user types.
- Email and password updates leverage Supabase Auth directly via shared components (`EmailChangeCard`).

### Database Considerations
- No schema changes are required as the `profiles` table already exists and serves all authenticated users.
- RLS on `profiles` already allows users to see and update their own records.
