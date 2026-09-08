-- Regional consent gate: prior opt-in where the law requires it (EU/EEA, UK,
-- Switzerland), optional trackers permitted by default elsewhere.
--
-- The singleton row was seeded with require_prior_opt_in_everywhere = true,
-- which put every visitor on earth behind the EU gate. RB2B and the LinkedIn
-- tag then loaded only for visitors who clicked "Accept all" — on a B2B site,
-- nearly nobody — and RB2B recorded no traffic while the tag was "installed".
-- The published privacy policy has described the regional rule all along; the
-- stored policy and the code default (src/lib/tracking/consent.ts) now agree
-- with it. The switch remains available at /admin/tracking.

alter table public.tracking_policy
  alter column require_prior_opt_in_everywhere set default false;

update public.tracking_policy
   set require_prior_opt_in_everywhere = false,
       updated_at = now()
 where id = true
   and require_prior_opt_in_everywhere = true;
