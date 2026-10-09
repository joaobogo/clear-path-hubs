/**
 * The business figures of the workspace — exactly one reader each.
 *
 * Every tile, banner, panel and count on the admin and client workspaces reads
 * from here. Nothing computes these figures locally: a component-local query is
 * how the same number came to read 1 on one page and 0 on the next.
 *
 *   confirmed hires            → countConfirmedHiresForOrg
 *   open roles                 → countOpenRolesForOrg / countRolesForOrg
 *   interviews held in a window→ countInterviewsHeld
 *   seats in use               → readSeatsForOrg / countSeatsInUse
 *   candidates in play         → countCandidatesInPlay
 *   open offers                → countOpenOffers
 */
export { readOrgRows, isOrgMember } from "@/lib/kpis/org-read.server";
export {
  loadOfferRecords,
  loadConfirmedHires,
  countConfirmedHiresForOrg,
  indexConfirmedHires,
  type ConfirmedHireRow,
} from "@/lib/kpis/confirmed-hires.server";
export {
  loadOrgRoles,
  loadOpenRoles,
  countRolesForOrg,
  countOpenRolesForOrg,
} from "@/lib/kpis/open-roles.server";
export {
  loadInterviewsHeld,
  countInterviewsHeld,
  interviewWindow,
} from "@/lib/kpis/interviews.server";
export { readSeatsForOrg, countSeatsInUse, type SeatCount } from "@/lib/kpis/seats.server";
export {
  loadVisibleMatches,
  selectCandidatesInPlay,
  countCandidatesInPlay,
  countOpenOffers,
} from "@/lib/kpis/candidates-in-play.server";
export { readOrgRollups, type OrgRollup } from "@/lib/kpis/org-rollups.server";
