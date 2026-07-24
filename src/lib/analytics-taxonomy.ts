/**
 * Canonical browser-side analytics event taxonomy.
 *
 * Naming: dot.case event names, snake_case prop keys.
 * Values MUST be primitive (string | number | boolean). No PII.
 * See docs/ops/analytics-and-alerting.md for the full contract.
 */

export const ANALYTICS_EVENTS = {
  // Marketing / public site
  CTA_CLICK: "cta.click",
  NAV_CLICK: "nav.click",
  HERO_VIEW: "hero.view",
  FOUNDER_CLICK: "founder.click",

  // Calculators & interactive tools
  ROI_CALC_STARTED: "roi.calc.started",
  ROI_CALC_COMPUTED: "roi.calc.computed",
  ROI_CALC_SHARED: "roi.calc.shared",
  INDUSTRY_EXPLORER_OPENED: "industry.explorer.opened",
  INDUSTRY_SIGNAL_TOGGLED: "industry.signal.toggled",

  // Resources / content
  RESOURCE_OPENED: "resource.opened",
  RESOURCE_SCROLL_50: "resource.scroll.50",
  RESOURCE_SCROLL_90: "resource.scroll.90",
  FAQ_EXPANDED: "faq.expanded",

  // Funnel — intake
  INTAKE_STARTED: "intake.started",
  INTAKE_STEP_ADVANCED: "intake.step.advanced",
  INTAKE_DRAFT_SAVED: "intake.draft.saved",
  INTAKE_SUBMITTED: "intake.submitted",

  // Funnel — application
  APPLY_STARTED: "apply.started",
  APPLY_CV_UPLOADED: "apply.cv.uploaded",
  APPLY_SUBMITTED: "apply.submitted",
  APPLY_FAILED: "apply.failed",

  // Product route usage
  ROUTE_VIEW: "route.view",
  DASHBOARD_TAB_CHANGED: "dashboard.tab.changed",

  // Key mutations
  POSITION_APPROVED: "position.approved",
  CANDIDATE_PUBLISHED: "candidate.published",
  SHORTLIST_SHARED: "shortlist.shared",
  HIRE_CONFIRMED: "hire.confirmed",

  // Assistant
  ASSISTANT_OPENED: "assistant.opened",
  ASSISTANT_MESSAGE_SENT: "assistant.message.sent",
  ASSISTANT_TOOL_INVOKED: "assistant.tool.invoked",
  ASSISTANT_FALLBACK_HUMAN: "assistant.fallback.human",
  ASSISTANT_ERROR: "assistant.error",

  // Reliability / SRE
  ERROR_BOUNDARY: "error.boundary",
  PIPELINE_FAILED: "pipeline.failed",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * Critical funnel events. Missing any of these on production traffic must
 * page ops within 15 minutes. Enforced by the monitoring dashboard.
 */
export const CRITICAL_FUNNEL_EVENTS: readonly AnalyticsEventName[] = [
  ANALYTICS_EVENTS.INTAKE_STARTED,
  ANALYTICS_EVENTS.INTAKE_SUBMITTED,
  ANALYTICS_EVENTS.APPLY_STARTED,
  ANALYTICS_EVENTS.APPLY_SUBMITTED,
  ANALYTICS_EVENTS.CANDIDATE_PUBLISHED,
  ANALYTICS_EVENTS.ASSISTANT_MESSAGE_SENT,
];

/** Human-fallback triggers — every one must open a support incident. */
export const FALLBACK_INCIDENT_EVENTS: readonly AnalyticsEventName[] = [
  ANALYTICS_EVENTS.ASSISTANT_FALLBACK_HUMAN,
  ANALYTICS_EVENTS.ASSISTANT_ERROR,
  ANALYTICS_EVENTS.PIPELINE_FAILED,
  ANALYTICS_EVENTS.APPLY_FAILED,
];
