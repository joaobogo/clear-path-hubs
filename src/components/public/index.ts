/**
 * Canonical public shell surface.
 *
 * All public routes must import shell primitives from `@/components/public`.
 * Underlying implementations currently live in `@/components/marketing/*`
 * for backwards compatibility with earlier phases and will be moved wholesale
 * in a follow-up refactor. Do not import the marketing/* paths directly in
 * new code.
 */

export {
  SiteShell as PublicPageShell,
  PublicPage as PublicPageContainer,
  PublicSection,
  Breadcrumbs,
  CtaSection as CTASection,
  PublicLoading as PublicLoadingState,
  PublicNotFound as PublicNotFoundState,
  PublicErrorState,
  SkipNav as SkipLink,
} from "@/components/marketing/site-shell";

export { FormShell as FocusedShell } from "@/components/marketing/form-shell";

export { PublicEmptyState } from "./public-empty-state";
export { PublicPageHeader } from "./public-page-header";
export {
  HeroCTAGroup,
  InlineCTA,
  SectionCTA,
  FinalCTASection,
  TextLinkCTA,
  EmployerCTA,
  CandidateCTA,
} from "./cta";
