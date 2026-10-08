import { screenDealBreakers, usableDealBreakers } from "@/lib/deal-breaker-screening";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import * as React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownToolbar, useMarkdownShortcuts } from "@/components/intake/markdown-toolbar";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { FormShell } from "@/components/marketing/form-shell";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  PILOT_INELIGIBLE_CLIENT_MESSAGE,
  PILOT_ONE_PER_COMPANY,
} from "@/lib/pilot-eligibility";

import {
  DEAL_BREAKER_EMPTY_HINT,
  DEAL_BREAKER_POLICY_LINE,
  DEAL_BREAKER_WHY_IT_MATTERS,
  DEFAULT_DEAL_BREAKER_LINES,
  MAX_DEAL_BREAKERS,
  MAX_DEAL_BREAKER_CHARS,
  normalizeDealBreakers,
  validateDealBreakers,
} from "@/lib/client-deal-breakers";
import { positionFieldByIntakeKey } from "@/lib/positions/field-registry";

/**
 * Labels and hints for the questions intake shares with the role editors come
 * from the position field registry, so the three forms cannot drift apart.
 */
const intakeFieldLabel = (key: string) => positionFieldByIntakeKey(key)?.label ?? key;
const intakeFieldHint = (key: string) => positionFieldByIntakeKey(key)?.hint;
import {
  ALLOWED_JD_EXT,
  COMP_CURRENCIES,
  splitLines,

  COMP_PERIODS,
  COMP_PERIOD_LABELS,
  COMP_EQUITY,
  COMP_EQUITY_LABELS,
  COMPENSATION_HONEST_LINE,
  COMPENSATION_WIDE_RANGE_WARNING,
  isWideCompensationRange,
  WORK_MODELS,
  WORK_MODEL_LABELS,
  EMPLOYMENT_TYPES,
  WORK_AUTHORIZATION_OPTIONS,
  SPONSORSHIP_OPTIONS,
  SPONSORSHIP_LABELS,
  SPONSORSHIP_WHY_IT_MATTERS,
  TIMEZONE_BANDS,
  TIMEZONE_BAND_LABELS,

  UNREADABLE_JD_EXT,
  JD_ACCEPT_ATTR,
  JD_ACCEPT_LABEL,

  EXPRESS_IDEMPOTENCY_KEY,
  INTAKE_STEPS,
  INTAKE_TOTAL_MINUTES,
  STEP_FIELDS,
  INTAKE_REQUIRED_LEGEND,
  intakeRequiredness,
  briefCompleteness,
  stepValidators,
  linesToRequirements,
  requirementsToLines,
  validateRequirements,
  type RequirementItem,

  MAX_JD_BYTES,
  MIN_ACCOUNT_PASSWORD,
  MIN_JD_TEXT,
  expressIntakeSchema,
  jdFileExt,

  DEFAULT_INTERVIEW_STAGE_TEMPLATE,
  INTERVIEW_STAGE_FORMATS,
  INTERVIEW_STAGE_FORMAT_LABELS,
  INTERVIEW_PROCESS_WHY_IT_MATTERS,
  COLLABORATOR_OPT_IN_LABEL,
  MAX_INTERVIEW_STAGES,
  MAX_STAGE_NAME_CHARS,
  MIN_TARGET_DAYS_TO_OFFER,
  MAX_TARGET_DAYS_TO_OFFER,
  collaboratorCandidates,
  interviewProcessSummary,
  validateInterviewStages,
  type InterviewStage,
  JD_REPARSE_DELAY_MS,
  type EmploymentType,
  companyWebsiteFromEmail,
} from "@/lib/express-intake-schema";

import { FieldExamples } from "@/components/intake/field-examples";
import { RequirementsList, type SuggestionState } from "@/components/intake/requirements-list";
import { BLUEPRINT_SENIORITY, type JdBlueprint } from "@/lib/jd-blueprint";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { clearIntakeDraft } from "@/lib/intake-draft.functions";
import {
  clearDraftMirror,
  emailIntakeResumeLink,
  fetchIntakeDraft,
  markIntakeSubmitted,
  useIntakeDraftSaver,
} from "@/lib/intake-draft-client";
import {
  INTAKE_DRAFT_EXPIRED_MESSAGE,
  INTAKE_DRAFT_RESTORING_LABEL,
  INTAKE_DRAFT_SAVE_ERROR_MESSAGE,
  INTAKE_DRAFT_SUBMITTED_MESSAGE,
  savedAtLabel,
  stripNeverPersisted,
} from "@/lib/intake-draft-shared";
import { submitToCrm } from "@/lib/crm/submit-form";
import { trackEvent } from "@/lib/tracking/pixels";
import { trackDashboardSignup } from "@/lib/tracking/conversions";
import { FGV_EVENTS, trackConfirmedConversion, trackFgv } from "@/lib/tracking/fgv-events";
import { PRICE_PILOT_USD } from "@/config/pricing-core";
import { PAYMENTS_ENABLED } from "@/config/commerce";
import { Check, CheckCircle2, Eye, EyeOff, FileText, Loader2, Upload, X } from "lucide-react";
import { IntakeReviewPanel } from "@/components/intake/review-panel";
import { buildIntakeReview } from "@/lib/intake-review";
import { intakeSubmitBlockers } from "@/lib/intake-submit-blockers";
import { CARRY_NOTICE, type CarryForward } from "@/lib/intake-carry";
import {
  COMPENSATION_STALE_DAYS,
  type DuplicateDraft,
} from "@/lib/position-duplicate";
import { getPositionDuplicateDraft } from "@/lib/position-duplicate.functions";
import { getCompanyCarryForward } from "@/lib/intake-carry.functions";
import { APP_LOCALE, WORKSPACE_TIMEZONE, formatDate } from "@/lib/format/datetime";

export const Route = createFileRoute("/intake")({
  /**
   * ?carry=<intake id> or ?carry=org starts a second role from the company
   * profile instead of a blank form. Anything else is ignored.
   */
  validateSearch: (search: Record<string, unknown>): { carry?: string; duplicate?: string } => {
    const carry = typeof search["carry"] === "string" ? (search["carry"] as string).trim() : "";
    const duplicate =
      typeof search["duplicate"] === "string" ? (search["duplicate"] as string).trim() : "";
    return { ...(carry ? { carry } : {}), ...(duplicate ? { duplicate } : {}) };
  },
  head: () => ({
    meta: [
      { title: "Start your hiring pilot — TaaSFlow" },
      {
        name: "description",
        content:
          "Tell us about your company, create your account and upload the job description. TaaSFlow builds the role blueprint, scoring rubric and sourcing plan for you.",
      },
      { property: "og:title", content: "Start your hiring pilot — TaaSFlow" },
      {
        property: "og:description",
        content:
          "Company details, your account, the job description. TaaSFlow builds the rest and shows you every step.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://taasflow.com/intake" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://taasflow.com/intake" }],
  }),
  component: ExpressIntakePage,
});

type FormState = {
  companyName: string;
  companyWebsite: string;
  companyLinkedin: string;
  firstName: string;
  lastName: string;
  contactTitle: string;
  workEmail: string;
  phone: string;
  contactLinkedin: string;
  password: string;
  confirmPassword: string;
  roleTitle: string;
  team: string;
  jobDescriptionText: string;
  mustHaves: string;
  niceToHaves: string;
  trainable: string;
  /** The tagged, ordered requirements list step 2 actually edits. */
  requirements: RequirementItem[];
  manyMustHavesConfirmed: boolean;
  dealBreakers: string;
  /** Up to five short lines: what rules someone out. */
  dealBreakerList: string[];

  location: string;
  workModel: "remote" | "hybrid" | "onsite" | "";
  /**
   * Read from the job description, never asked on screen. The admin publish
   * gate requires both and the client flow asked for neither, so every brief
   * arrived under-specified (audit 15 Sep, INT-002).
   */
  seniority: string;
  employmentType: EmploymentType | "";
  /**
   * The file the description was read out of, if it came from one. Name only:
   * the text itself is already in jobDescriptionText, and carrying 10 MB of
   * base64 in a draft row to redraw one chip is not a trade worth making.
   */
  jdSourceName: string;
  onsiteDays: string;
  remoteTimezones: string[];
  remoteAnywhereInCountry: boolean;
  sponsorshipAvailable: "yes" | "no" | "";
  currency: string;
  compensationPeriod: string;
  salaryMin: string;
  salaryMax: string;
  compensationNote: string;
  compensationUndecided: boolean;
  bonusStructure: string;
  equity: string;
  compensationFlexible: boolean;
  wideRangeConfirmed: boolean;
  workAuthorization: string;
  workAuthorizationNote: string;
  interviewProcess: string;
  interviewStages: InterviewStage[];
  targetDaysToOffer: string;
  inviteCollaborators: boolean;
  decisionMakerEmail: string;
  decisionMaker: string;

  targetStartDate: string;
  consent: boolean;
  pilotAcknowledgement: boolean;
  researchConsent: boolean;
  companyFax: string;
};

const EMPTY: FormState = {
  companyName: "",
  companyWebsite: "",
  companyLinkedin: "",
  firstName: "",
  lastName: "",
  contactTitle: "",
  workEmail: "",
  phone: "",
  contactLinkedin: "",
  password: "",
  confirmPassword: "",
  roleTitle: "",
  team: "",
  jobDescriptionText: "",
  mustHaves: "",
  niceToHaves: "",
  trainable: "",
  requirements: [],
  manyMustHavesConfirmed: false,
  dealBreakers: "",
  dealBreakerList: Array.from({ length: DEFAULT_DEAL_BREAKER_LINES }, () => ""),

  location: "",
  workModel: "",
  seniority: "",
  employmentType: "",
  jdSourceName: "",
  onsiteDays: "",
  remoteTimezones: [],
  remoteAnywhereInCountry: false,
  // No default: sponsorship is answered by the client, never assumed.
  sponsorshipAvailable: "",
  currency: "USD",
  compensationPeriod: "year",
  salaryMin: "",
  salaryMax: "",
  compensationNote: "",
  compensationUndecided: false,
  bonusStructure: "",
  equity: "",
  compensationFlexible: false,
  wideRangeConfirmed: false,
  workAuthorization: "",
  workAuthorizationNote: "",
  interviewProcess: "",
  // Empty until the client accepts or writes a process. The suggested template
  // is offered on screen, never pre-submitted.
  interviewStages: [],
  targetDaysToOffer: "",
  inviteCollaborators: false,
  decisionMakerEmail: "",
  decisionMaker: "",

  targetStartDate: "",
  consent: false,
  pilotAcknowledgement: false,
  researchConsent: false,
  companyFax: "",
};


type JdFile = { filename: string; mime: string; base64: string; size: number };

function newIdempotencyKey(): string {
  return `exp_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Older drafts stored three line-separated strings. Rebuild the tagged list from
 * them so a returning client never loses their requirements.
 */
function withRequirements(patch: Partial<FormState>): Partial<FormState> {
  if (Array.isArray(patch.requirements) && patch.requirements.length > 0) return patch;
  const rebuilt = linesToRequirements({
    mustHaves: patch.mustHaves ?? "",
    niceToHaves: patch.niceToHaves ?? "",
    trainable: patch.trainable ?? "",
  });
  return rebuilt.length > 0 ? { ...patch, requirements: rebuilt } : patch;
}

/**
 * Company defaults for a role started from a submission reference. Public and
 * deliberately contact-free; the signed-in path adds the contact details.
 */
async function fetchCarryByIntakeId(intakeId: string): Promise<CarryForward | null> {
  try {
    const res = await fetch(`/api/public/intake-carry/${intakeId}`, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean } & Partial<CarryForward>;
    if (!json.ok || !json.values || !json.carried) return null;
    return { companyName: json.companyName ?? null, values: json.values, carried: json.carried };
  } catch {
    return null;
  }
}

/** Later sources only fill gaps — never overwrite an answer already carried. */
function mergeCarry(base: CarryForward | null, extra: CarryForward | null): CarryForward | null {
  if (!base) return extra;
  if (!extra) return base;
  const values = { ...extra.values, ...base.values };
  return {
    companyName: base.companyName ?? extra.companyName,
    values,
    carried: Object.keys(values) as CarryForward["carried"],
  };
}

function ExpressIntakePage() {
  const navigate = useNavigate();
  // Until React has taken over the page, typing into these fields would be
  // wiped by hydration and taps would do nothing. Show a placeholder instead.
  const hydrated = useHydrated();
  const [state, setState] = useState<FormState>(EMPTY);
  const [jdFile, setJdFile] = useState<JdFile | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const idem = useRef<string>("");
  const startedRef = useRef(false);
  // Fields the client has already typed into. A draft lookup that lands late
  // must never overwrite an answer that is newer than the draft.
  const editedRef = useRef<Set<string>>(new Set<string>());

  const pastedRef = useRef(false);
  const [authed, setAuthed] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [draftPhase, setDraftPhase] = useState<"restoring" | "ready">("restoring");
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [resumeEmailState, setResumeEmailState] = useState<
    { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error" }
  >({ kind: "idle" });
  const [emailStatus, setEmailStatus] = useState<
    { kind: "idle" } | { kind: "checking" } | { kind: "exists"; message: string } | { kind: "free" }
  >({ kind: "idle" });
  const [accountBusy, setAccountBusy] = useState(false);
  const [signInMode, setSignInMode] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  // Set while the client is away editing one answer from the review panel, so
  // Continue takes them straight back to review instead of walking the steps.
  const [returnToReview, setReturnToReview] = useState(false);
  const pendingFocus = useRef<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /**
   * Set when the company has already used its one pilot. Holds the step that
   * continues onboarding, so nothing is lost — the client just sees the truth
   * first.
   */
  const [pilotNotice, setPilotNotice] = useState<(() => void) | null>(null);

  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [stageErrors, setStageErrors] = useState<
    Record<number, { name?: string; format?: string; ownerEmail?: string }>
  >({});

  const [suggestions, setSuggestions] = useState<SuggestionState>({ kind: "idle" });
  /** The link the client asked us to read. Not part of the brief itself. */
  const [jdUrl, setJdUrl] = useState("");
  const suggestedForRef = useRef<string>("");
  const jdRequestSeqRef = useRef(0);
  const latestJdTextRef = useRef(state.jobDescriptionText);
  latestJdTextRef.current = state.jobDescriptionText;
  const lastIntentRef = useRef<"pay" | "call">("pay");
  const hydratedRef = useRef(false);
  const { carry: carryParam, duplicate: duplicateParam } = Route.useSearch();
  const loadCompanyCarry = useServerFn(getCompanyCarryForward);
  const loadDuplicateDraft = useServerFn(getPositionDuplicateDraft);
  // Duplicating a role copies the brief and nothing else. What came across and
  // what deliberately did not is stated on screen, not assumed.
  const [duplicate, setDuplicate] = useState<DuplicateDraft | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [dupTitleConfirmed, setDupTitleConfirmed] = useState(false);
  const [dupCompReviewed, setDupCompReviewed] = useState(false);
  // The answers that arrived from the company profile, so each one can say so
  // — and stop saying so the moment the client edits it for this role.
  const [carriedFields, setCarriedFields] = useState<Set<string>>(() => new Set());
  const [carryCompany, setCarryCompany] = useState<string | null>(null);
  const isCarried = (field: string) => carriedFields.has(field);

  const currentStep = INTAKE_STEPS[stepIndex];
  const step = stepIndex + 1;
  const minutesLeft = INTAKE_STEPS.slice(stepIndex).reduce((sum, s) => sum + s.minutes, 0);

  /**
   * Requiredness comes from the same map the server validator uses, so the
   * asterisks on screen can never disagree with what submit will accept.
   */
  const req = React.useMemo(
    () =>
      intakeRequiredness({
        hasJdFile: Boolean(jdFile),
        authed,
        signInMode,
        workModel: state.workModel,
        remoteAnywhereInCountry: state.remoteAnywhereInCountry,
      }),
    [jdFile, authed, signInMode, state.workModel, state.remoteAnywhereInCountry],
  );

  // What is still missing from the brief, in the client's own words. Shown
  // before submit so an incomplete brief is a stated choice, not a surprise.
  const brief = briefCompleteness({
    location: state.location,
    workModel: state.workModel,
    remoteTimezones: state.remoteTimezones,
    remoteAnywhereInCountry: state.remoteAnywhereInCountry,
    salaryMin: state.salaryMin === "" ? 0 : Number(state.salaryMin),
    workAuthorization: state.workAuthorization,
    interviewProcess: state.interviewProcess,
    interviewStages: state.interviewStages,

    decisionMaker: state.decisionMaker,
    dealBreakers: state.dealBreakers,
    dealBreakerList: state.dealBreakerList,
  });

  /**
   * The whole brief on one screen before submit. Built from the same state the
   * form writes and the same requiredness map the server validates against, so
   * review can never show something different from what gets submitted.
   */
  const review = React.useMemo(() => {
    const salary = state.salaryMin && state.salaryMax
      ? `${state.currency} ${Number(state.salaryMin).toLocaleString(APP_LOCALE)}–${Number(state.salaryMax).toLocaleString(APP_LOCALE)} ${COMP_PERIOD_LABELS[state.compensationPeriod as "year"]}`
      : state.salaryMin
        ? `From ${state.currency} ${Number(state.salaryMin).toLocaleString(APP_LOCALE)} ${COMP_PERIOD_LABELS[state.compensationPeriod as "year"]}`
        : state.salaryMax
          ? `Up to ${state.currency} ${Number(state.salaryMax).toLocaleString(APP_LOCALE)} ${COMP_PERIOD_LABELS[state.compensationPeriod as "year"]}`
          : "";
    const compensation = state.compensationUndecided
      ? "Not decided yet"
      : [
          salary,
          state.bonusStructure.trim() ? `Bonus: ${state.bonusStructure.trim()}` : "",
          state.equity ? COMP_EQUITY_LABELS[state.equity as "none"] : "",
          state.compensationFlexible ? "Flexible for the right person" : "",
          state.compensationNote.trim(),
        ].filter(Boolean).join(" · ");

    return buildIntakeReview({
      snapshot: {
        roleTitle: state.roleTitle,
        team: state.team,
        seniorityLabel: state.seniority ? state.seniority.replaceAll("_", " ") : "",
        employmentTypeLabel: state.employmentType ? state.employmentType.replaceAll("_", " ") : "",
        jobDescriptionText: state.jobDescriptionText,
        jdFilename: jdFile ? jdFile.filename : null,
        requirements: state.requirements.map((r) => ({ text: r.text, tag: String(r.tag) })),
        location: state.location,
        workModelLabel: state.workModel ? WORK_MODEL_LABELS[state.workModel] : "",
        onsiteDays: state.workModel === "hybrid" ? state.onsiteDays : "",
        remoteAnywhereInCountry:
          state.workModel === "remote" && state.remoteAnywhereInCountry,
        remoteTimezoneLabels:
          state.workModel === "remote"
            ? state.remoteTimezones.map((t) => TIMEZONE_BAND_LABELS[t] ?? t)
            : [],
        sponsorshipLabel: state.sponsorshipAvailable
          ? SPONSORSHIP_LABELS[state.sponsorshipAvailable]
          : "",
        compensationLine: compensation,
        workAuthorizationLabel:
          WORK_AUTHORIZATION_OPTIONS.find((o) => o.value === state.workAuthorization)?.label ?? "",
        workAuthorizationNote: state.workAuthorizationNote,
        targetStartDate: state.targetStartDate,
        interviewStageLines: state.interviewStages
          .filter((st) => st.name.trim())
          .map((st) => [
            st.name.trim(),
            INTERVIEW_STAGE_FORMAT_LABELS[st.format] ?? st.format,
            st.ownerName.trim() ? `Owner: ${st.ownerName.trim()}` : "",
            st.ownerEmail.trim() ? st.ownerEmail.trim() : "",
          ].filter(Boolean).join(" · ")),
        interviewProcess: state.interviewProcess,
        targetDaysToOffer: state.targetDaysToOffer,
        decisionMaker: state.decisionMaker,
        decisionMakerEmail: state.decisionMakerEmail,
        collaboratorLine: state.inviteCollaborators
          ? collaboratorCandidates(state.interviewStages, { name: state.decisionMaker, email: state.decisionMakerEmail })
            .map((person) => `${person.name || "Team member"} (${person.email})`).join("\n")
          : "",
        // Only the rules we will actually apply. The review screen used to
        // list a flagged entry among the accepted ones, which a client
        // reasonably reads as "this will be used" (audit 1 Sep, F12).
        dealBreakers: usableDealBreakers(normalizeDealBreakers(state.dealBreakerList)),
        companyName: state.companyName,
        companyWebsite: state.companyWebsite,
        companyLinkedin: state.companyLinkedin,
        firstName: state.firstName,
        lastName: state.lastName,
        contactTitle: state.contactTitle,
        workEmail: state.workEmail,
        phone: state.phone,
        contactLinkedin: state.contactLinkedin,
      },
      required: req,
      // Answers that live outside the text state: ticks, files, typed secrets.
      satisfied: {
        jobDescriptionText: Boolean(jdFile) || state.jobDescriptionText.trim().length > 0,
        consent: state.consent,
        pilotAcknowledgement: state.pilotAcknowledgement,
        password: state.password.length > 0,
        confirmPassword: state.confirmPassword.length > 0,
      },
    });
  }, [state, jdFile, req]);

  /**
   * Location, on-site expectation and authorisation rules, in one place so the
   * step check and the submit check can never drift apart.
   */
  const placementErrors = (): Record<string, string> => {
    const out: Record<string, string> = {};
    const days = state.onsiteDays === "" ? null : Number(state.onsiteDays);
    if (state.workModel === "hybrid" || state.workModel === "onsite") {
      if (!state.location.trim()) out.location = "Which city and country is this based in?";
    }
    if (state.workModel === "hybrid") {
      if (days === null) out.onsiteDays = "How many days on site each week?";
      else if (days < 1 || days > 5) out.onsiteDays = "Between 1 and 5 days a week";
    }
    if (
      state.workModel === "remote" &&
      state.remoteTimezones.length === 0 &&
      !state.remoteAnywhereInCountry
    ) {
      out.remoteTimezones =
        "Pick at least one acceptable timezone, or say anywhere in the country";
    }
    if (!state.sponsorshipAvailable) {
      out.sponsorshipAvailable = "Answer yes or no — we do not assume either way";
    }
    return out;
  };

  /**
   * Interview process rules, shared by the step check and the submit check. An
   * untouched list is allowed; a started one has to be coherent.
   */
  const processErrors = () => {
    const stages = state.interviewStages;
    const days = state.targetDaysToOffer === "" ? null : Number(state.targetDaysToOffer);
    const base =
      stages.length === 0
        ? { ok: true, rowErrors: {} as Record<number, { name?: string; format?: string; ownerEmail?: string }>, listError: undefined as string | undefined, targetError: undefined as string | undefined }
        : validateInterviewStages(stages, { targetDaysToOffer: days });
    let targetError = base.targetError;
    if (stages.length === 0 && days !== null) {
      if (!Number.isFinite(days) || days < MIN_TARGET_DAYS_TO_OFFER || days > MAX_TARGET_DAYS_TO_OFFER) {
        targetError = `Between ${MIN_TARGET_DAYS_TO_OFFER} and ${MAX_TARGET_DAYS_TO_OFFER} days`;
      }
    }
    const email = state.decisionMakerEmail.trim();
    const decisionMakerEmail =
      email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
        ? "Enter a valid email address"
        : undefined;
    return { rowErrors: base.rowErrors, listError: base.listError, targetError, decisionMakerEmail };
  };



  /**
   * Choosing a different work model drops the answers that no longer apply, so
   * a hidden field can never submit a stale value from an earlier selection.
   */
  const onWorkModelChange = (value: FormState["workModel"]) => {
    setState((s) => ({
      ...s,
      workModel: value,
      onsiteDays: value === "hybrid" ? s.onsiteDays : "",
      remoteTimezones: value === "remote" ? s.remoteTimezones : [],
      remoteAnywhereInCountry: value === "remote" ? s.remoteAnywhereInCountry : false,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.workModel;
      delete next.onsiteDays;
      delete next.remoteTimezones;
      delete next.location;
      return next;
    });
  };

  const toggleTimezone = (value: string) => {
    setState((s) => ({
      ...s,
      remoteTimezones: s.remoteTimezones.includes(value)
        ? s.remoteTimezones.filter((t) => t !== value)
        : [...s.remoteTimezones, value],
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.remoteTimezones;
      return next;
    });
  };

  /** Move focus and announcement to the first invalid field on this step. */
  // Job description formatting. The field stores markdown either way; the
  // toolbar just stops the client having to type the syntax themselves.
  const jdTextRef = useRef<HTMLTextAreaElement | null>(null);
  const jdShortcuts = useMarkdownShortcuts(jdTextRef, state.jobDescriptionText, (next) =>
    set("jobDescriptionText", next),
  );

  const focusFirstError = () => {
    // Two frames, not one. The error is written with setState immediately
    // before this runs, so on the first frame React has not committed it yet
    // and the query matches nothing — the scroll silently never happened and
    // the client was told to check a highlight that was never brought into
    // view. The second frame runs after the commit.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const err = document.querySelector<HTMLElement>("[data-field-error='true']");
        if (!err) return;
        err.scrollIntoView({ behavior: "smooth", block: "center" });
        const field = err.closest("[data-field]")?.querySelector<HTMLElement>(
          "input, textarea, select",
        );
        (field ?? err).focus?.();
      });
    });
  };

  /** Validate only the fields belonging to the step being left. */
  const validateStep = (index: number): boolean => {
    const key = INTAKE_STEPS[index].key;
    const next: Record<string, string> = {};
    // The first row-level problem, kept so the toast can name it. Row errors
    // live in their own state and render beside the row, which on a 21-row
    // requirements list is often far below the fold — "check the highlighted
    // fields" then points at something the client cannot see.
    let firstRowMessage: string | null = null;
    if (key === "company") {
      // The description is asked here now, so it is checked here.
      const jd = state.jobDescriptionText.trim();
      if (!jdFile && jd.length < MIN_JD_TEXT) {
        next.jobDescriptionText = jd.length
          ? "Paste the job description or upload the file"
          : "Upload a job description file or paste the description";
      }
      const res = stepValidators.company.safeParse({
        companyName: state.companyName,
        firstName: state.firstName,
        lastName: state.lastName,
        workEmail: state.workEmail,
      });
      if (!res.success) {
        for (const issue of res.error.issues) {
          const f = String(issue.path[0] ?? "form");
          if (!next[f]) next[f] = issue.message;
        }
      }
    }
    let hardFail = false;
    if (key === "role") {
      const res = stepValidators.role.safeParse({
        roleTitle: state.roleTitle,
        companyWebsite: state.companyWebsite,
      });
      if (!res.success) {
        for (const issue of res.error.issues) {
          const f = String(issue.path[0] ?? "form");
          if (!next[f]) next[f] = issue.message;
        }
      }
    }
    if (key === "role") {
      const res = validateRequirements(state.requirements, {
        manyConfirmed: state.manyMustHavesConfirmed,
      });
      // Row problems render under their own row; only the list-level message
      // belongs in the shared error map.
      setRowErrors(res.rowErrors);
      if (res.listError) next.requirements = res.listError;
      const firstIndex = Object.keys(res.rowErrors)
        .map(Number)
        .sort((a, b) => a - b)[0];
      if (firstIndex !== undefined) {
        firstRowMessage = `Requirement ${firstIndex + 1}: ${res.rowErrors[firstIndex]}`;
      }
      hardFail = !res.ok;
    }
    if (key === "details") {
      // Optional step: only what was filled in has to make sense.
      if (state.salaryMin !== "" && state.salaryMax === "") {
        next.salaryMax = "Add the top of the range too, or clear both";
      }
      if (state.salaryMax !== "" && state.salaryMin === "") {
        next.salaryMin = "Add the bottom of the range too, or clear both";
      }
      if (
        state.salaryMin !== "" &&
        state.salaryMax !== "" &&
        Number(state.salaryMax) < Number(state.salaryMin)
      ) {
        next.salaryMax = "The top of the range must be at least the bottom";
      }
      if (state.compensationUndecided && (state.salaryMin !== "" || state.salaryMax !== "")) {
        next.compensationUndecided = "Clear the range, or untick 'Not decided yet'";
      }
      if (
        isWideCompensationRange(Number(state.salaryMin) || 0, Number(state.salaryMax) || 0) &&
        !state.wideRangeConfirmed
      ) {
        next.wideRangeConfirmed = COMPENSATION_WIDE_RANGE_WARNING;
      }
      Object.assign(next, placementErrors());
    }
    if (key === "details") {
      // Optional step: an untouched stage list is fine, a half-built one is not.
      const res = processErrors();
      setStageErrors(res.rowErrors);
      if (res.listError) next.interviewStages = res.listError;
      if (res.targetError) next.targetDaysToOffer = res.targetError;
      if (res.decisionMakerEmail) next.decisionMakerEmail = res.decisionMakerEmail;
      hardFail = hardFail || Object.keys(res.rowErrors).length > 0;
    }

    const fields = STEP_FIELDS[key];
    setErrors((prev) => {
      const carried = { ...prev };
      for (const f of fields) delete carried[f];
      return { ...carried, ...next };
    });
    if (hardFail || Object.keys(next).length > 0) {
      // Say what is actually wrong. The highlighted field is usually far from
      // the Continue button — on the requirements step it can be twenty rows
      // down — so a toast that only says "check the highlighted fields" leaves
      // the client hunting for a problem they cannot see.
      const reason = firstRowMessage ?? Object.values(next)[0] ?? null;
      toast.error(reason ?? "Please check the highlighted fields on this step.");
      focusFirstError();
      return false;
    }

    return true;
  };

  const goToStep = (index: number) => {
    if (index === stepIndex) return;
    // Going back never blocks. Jumping forward respects the gating steps.
    if (index > stepIndex) {
      for (let i = stepIndex; i < index; i++) {
        if (INTAKE_STEPS[i].required && !validateStep(i)) {
          setStepIndex(i);
          return;
        }
      }
    }
    setStepIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goNext = (skipValidation = false) => {
    // "Finish this later" skips the checks on an optional step; Continue never does.
    if (!skipValidation && !validateStep(stepIndex)) return;

    // The step the client just cleared, named by its step key. Raised after
    // validation so a Continue that was blocked never counts as completed.
    // Both call sites are gated on stepIndex < last, so this only ever reports
    // "company" and "role" — the details step is measured by the submit event.
    trackFgv(FGV_EVENTS.jobIntakeStep, { intake_step: INTAKE_STEPS[stepIndex].key });

    if (returnToReview) {
      // Came here from the review panel: go back to it, not to the next step.
      setReturnToReview(false);
      setStepIndex(INTAKE_STEPS.length - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setStepIndex((i) => Math.min(i + 1, INTAKE_STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    if (returnToReview) {
      setReturnToReview(false);
      setStepIndex(INTAKE_STEPS.length - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setStepIndex((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /**
   * Send the client from a review row to the answer behind it. State is never
   * touched, so every other answer survives the round trip.
   */
  const editFromReview = (target: { step: number; focusLabel: string | null }) => {
    pendingFocus.current = target.focusLabel;
    const last = INTAKE_STEPS.length - 1;
    if (target.step !== stepIndex) {
      setReturnToReview(target.step !== last);
      setStepIndex(target.step);
    }
    focusReviewTarget(target.focusLabel);
  };

  /** Scroll to and focus the control a review row points at. */
  const focusReviewTarget = (focusLabel: string | null) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = focusLabel
          ? document.querySelector<HTMLElement>(`[data-field="${focusLabel}"]`)
          : null;
        // Optional answers live inside collapsed <details> disclosures. A
        // closed one hides its subtree, so the scroll below is a no-op and
        // focus() is refused — the review's Edit link did nothing at all.
        let disclosure = container?.closest("details") ?? null;
        while (disclosure) {
          disclosure.open = true;
          disclosure = disclosure.parentElement?.closest("details") ?? null;
        }
        const el = container ?? document.querySelector<HTMLElement>("form, main");
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        const control = container?.querySelector<HTMLElement>("input, textarea, select, button");
        control?.focus?.();
        pendingFocus.current = null;
      });
    });
  };

  // A step change caused by an Edit link still has to land on the field.
  useEffect(() => {
    if (pendingFocus.current === null) return;
    focusReviewTarget(pendingFocus.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);



  // A draft belongs to the person, not the tab: it is loaded from the server on
  // every visit — account first, private draft token otherwise — so a closed
  // laptop, a new tab, or another device all resume the same brief. Passwords
  // and consent ticks are never persisted.
  const draftSaver = useIntakeDraftSaver({
    authed,
    getPayload: () => stripNeverPersisted(state as unknown as Record<string, unknown>),
    getLastStep: () => stepIndex,
  });
  const { savedAt, setSavedAt, saving: savingDraft, saveError, submittedElsewhere, queueSave, saveNow } =
    draftSaver;

  const applyDraftPayload = (payload: Record<string, unknown>) => {
    const restored = withRequirements(payload as Partial<FormState>) as Record<string, unknown>;
    // Keep whatever the client typed while the draft was still loading.
    for (const key of editedRef.current) delete restored[key];
    setState((s) => ({
      ...s,
      ...(restored as Partial<FormState>),
      password: "",
      confirmPassword: "",
      consent: false,
      pilotAcknowledgement: false,
      researchConsent: false,
    }));
  };


  /**
   * Carried answers land as ordinary editable values. They are marked as
   * inherited so the client can see what to check, and they never write back to
   * the company profile — role two edits stay in role two.
   */
  const applyCarry = (carry: CarryForward | null) => {
    if (!carry || carry.carried.length === 0) return;
    setState((s) => ({ ...s, ...(carry.values as Partial<FormState>) }));
    setCarriedFields(new Set<string>(carry.carried as unknown as string[]));
    setCarryCompany(carry.companyName);
  };

  useEffect(() => {
    try {
      // A new role must never reuse the previous role's idempotency key, or the
      // server would replay the first submission instead of creating a second.
      const existingIdem = carryParam || duplicateParam ? null : localStorage.getItem(EXPRESS_IDEMPOTENCY_KEY);
      idem.current = existingIdem || newIdempotencyKey();
      localStorage.setItem(EXPRESS_IDEMPOTENCY_KEY, idem.current);
    } catch {
      idem.current = newIdempotencyKey();
    }
    trackEvent("express_intake_viewed", { flow: "express_onboarding" });

    let cancelled = false;
    // The form must never be held hostage by a slow draft lookup.
    const safety = setTimeout(() => {
      if (!cancelled) setDraftPhase("ready");
    }, 6000);
    void (async () => {
      let signedIn = false;
      let signedInEmail: string | null = null;
      try {
        const { data: sess } = await supabase.auth.getSession();
        if (sess?.session) {
          const { data } = await supabase.auth.getUser();
          const user = data?.user;
          if (user?.email) {
            signedIn = true;
            signedInEmail = user.email;
            // This wizard also creates the account, so it is for visitors only.
            // Someone who already belongs to a workspace gets the in-app role
            // creation flow instead of a signup screen they cannot complete.
            try {
              const { data: rows } = await supabase
                .from("memberships")
                .select("organization_id, role")
                .eq("user_id", user.id)
                .eq("status", "active")
                .limit(5);
              const workspace = (rows ?? []).find((r) =>
                String(r.role ?? "").startsWith("client_"),
              );
              if (workspace && !cancelled) {
                clearTimeout(safety);
                void navigate({ to: "/client/positions/new", replace: true });
                return;
              }
            } catch {
              /* membership lookup failed — fall through to the normal form */
            }
            if (!cancelled) {
              setAuthed(true);
              setAccountEmail(user.email);
              const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
              const full = typeof meta.full_name === "string" ? meta.full_name : "";
              const [first, ...rest] = full.split(" ");
              setState((s2) => ({
                ...s2,
                workEmail: s2.workEmail || user.email!,
                firstName: s2.firstName || first || "",
                lastName: s2.lastName || rest.join(" "),
                password: "",
                confirmPassword: "",
              }));
            }
          }
        }
      } catch {
        /* anonymous visitor — normal path */
      }

      if (duplicateParam) {
        // A duplicate copies the brief only, and lands on the review step so the
        // client checks it instead of submitting blind. A failure here changes
        // nothing about the original role.
        try {
          const result = await loadDuplicateDraft({ data: { positionId: duplicateParam } });
          if (cancelled) return;
          if (!result?.draft) {
            setDuplicateError(
              "We could not find that role to duplicate. Your original role is unchanged \u2014 start this brief from scratch or try again from the role page.",
            );
          } else {
            const dup = result.draft;
            applyCarry(result.carry);
            setState((prev) => ({ ...prev, ...(dup.values as Partial<FormState>) }));
            setDuplicate(dup);
            setStepIndex(INTAKE_STEPS.length - 1);
          }
        } catch {
          if (!cancelled) {
            setDuplicateError(
              "We could not prepare the duplicate. Your original role is unchanged \u2014 nothing was copied or altered.",
            );
          }
        } finally {
          if (!cancelled) {
            setDraftPhase("ready");
            hydratedRef.current = true;
          }
        }
        return;
      }

      if (carryParam) {
        // Starting another role: begin from the company profile, not from the
        // draft of the role that was just submitted.
        try {
          let carry: CarryForward | null =
            carryParam === "org" ? null : await fetchCarryByIntakeId(carryParam);
          if (signedIn) {
            try {
              carry = mergeCarry(carry, await loadCompanyCarry());
            } catch {
              /* company lookup unavailable — carried company fields still apply */
            }
          }
          if (!cancelled) applyCarry(carry);
        } catch {
          /* nothing carried — the client fills the form as usual */
        } finally {
          if (!cancelled) {
            setDraftPhase("ready");
            hydratedRef.current = true;
          }
        }
        return;
      }

      try {
        const remote = await fetchIntakeDraft(signedIn, signedInEmail);
        if (cancelled) return;
        if (remote.status === "restored" && remote.payload) {
          applyDraftPayload(remote.payload);
          if (remote.savedAt) setSavedAt(remote.savedAt);
          if (
            Number.isInteger(remote.lastStep) &&
            remote.lastStep > 0 &&
            remote.lastStep < INTAKE_STEPS.length
          ) {
            setStepIndex(remote.lastStep);
          }
          setDraftNotice(null);
        } else if (remote.status === "expired") {
          setDraftNotice(INTAKE_DRAFT_EXPIRED_MESSAGE);
        } else if (remote.status === "submitted") {
          clearDraftMirror();
          setDraftNotice(INTAKE_DRAFT_SUBMITTED_MESSAGE);
        }
      } catch {
        /* no draft reachable — the form still works, saves will retry */
      } finally {
        if (!cancelled) {
          setDraftPhase("ready");
          hydratedRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, []);

  // Signing in mid-form moves the draft onto the account.
  useEffect(() => {
    if (!hydratedRef.current || !authed) return;
    void saveNow();
  }, [authed, saveNow]);

  // Moving between steps is a deliberate checkpoint — save immediately.
  useEffect(() => {
    if (!hydratedRef.current) return;
    void saveNow();
  }, [stepIndex, saveNow]);

  useEffect(() => {
    if (submittedElsewhere) setDraftNotice(INTAKE_DRAFT_SUBMITTED_MESSAGE);
  }, [submittedElsewhere]);

  const sendResumeLink = async () => {
    const email = (accountEmail ?? state.workEmail).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setResumeEmailState({ kind: "error" });
      return;
    }
    setResumeEmailState({ kind: "sending" });
    try {
      await saveNow();
      await emailIntakeResumeLink({
        email,
        roleTitle: state.roleTitle || undefined,
        stepLabel: `Step ${stepIndex + 1} of ${INTAKE_STEPS.length}: ${INTAKE_STEPS[stepIndex]!.title}`,
      });
      setResumeEmailState({ kind: "sent", email });
    } catch {
      setResumeEmailState({ kind: "error" });
    }
  };


  // Recognise a returning client before they type a password.
  const checkEmail = async () => {
    const email = state.workEmail.trim().toLowerCase();
    if (authed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    setEmailStatus({ kind: "checking" });
    try {
      const res = await fetch("/api/public/intake-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "check", email }),
      });
      const body = await res.json();
      if (body?.exists) {
        setEmailStatus({ kind: "exists", message: body.message });
        setSignInMode(true);
      } else {
        setEmailStatus({ kind: "free" });
      }
    } catch {
      setEmailStatus({ kind: "idle" });
    }
  };

  /**
   * The account exists now, so the brief keeps going by itself: straight on to
   * the role. If something on this step is still missing we stay put and show
   * it, rather than carrying an incomplete answer forward.
   */
  const continueAfterAccount = () => {
    if (stepIndex !== 0) return;
    setTimeout(() => {
      if (!validateStep(0)) return;
      setStepIndex(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 300);
  };

  const createAccountInline = async () => {
    const email = state.workEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setErrors((e) => ({ ...e, workEmail: "Enter the work email you'd like to sign in with." }));
      return;
    }
    if (state.password.length < MIN_ACCOUNT_PASSWORD) {
      setErrors((e) => ({
        ...e,
        password: `Choose a password of at least ${MIN_ACCOUNT_PASSWORD} characters.`,
      }));
      return;
    }
    if (state.password !== state.confirmPassword) {
      setErrors((e) => ({ ...e, confirmPassword: "The two passwords don't match yet." }));
      return;
    }
    setAccountBusy(true);
    try {
      const res = await fetch("/api/public/intake-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          email,
          password: state.password,
          firstName: state.firstName,
          lastName: state.lastName,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) {
        if (body?.error === "account_exists") {
          // A recognised client is not an error: point them at sign-in and keep
          // every answer exactly where it is.
          setEmailStatus({ kind: "exists", message: body.message });
          setSignInMode(true);
          toast.info(
            body?.message ??
              "That email already has an account. Sign in below — nothing you've typed is lost.",
          );
          return;
        }
        toast.error(body?.message ?? "We couldn't create your account. Please try again.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password: state.password });
      if (error) {
        toast.error("Account created, but we couldn't sign you in. Try signing in below.");
        setSignInMode(true);
        return;
      }
      setAuthed(true);
      setAccountEmail(email);
      trackEvent("account_created_from_intake", { flow: "express_onboarding" });
      trackDashboardSignup({ method: "email_password", plan: "express_onboarding" });
      toast.success("Account created. Everything you've typed is saved to it.");
      continueAfterAccount();
    } catch {
      toast.error("Network problem. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  };

  const signInInline = async () => {
    const email = state.workEmail.trim().toLowerCase();
    if (!state.password) {
      setErrors((e) => ({ ...e, password: "Enter your password to sign in." }));
      return;
    }
    setAccountBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: state.password });
      if (error) {
        toast.error("That email and password don't match. Try again or reset your password.");
        return;
      }
      setAuthed(true);
      setAccountEmail(email);
      setEmailStatus({ kind: "idle" });
      // The password has done its job — the session is the credential now.
      // Leaving it in state dead-ended the whole form: submit sent
      // password="what they typed" with confirmPassword="", the schema's
      // match refine failed, and the failing fields were hidden because the
      // user was signed in. "Both passwords must match", nothing to fix,
      // no way through but a refresh.
      setState((s) => ({ ...s, password: "", confirmPassword: "" }));
      setErrors((e) => ({ ...e, password: "", confirmPassword: "" }));
      toast.success("Signed in. This role will be added to your existing organisation.");
      continueAfterAccount();
    } catch {
      toast.error("Network problem. Please try again.");
    } finally {
      setAccountBusy(false);
    }
  };

  const googleSignIn = async () => {
    setAccountBusy(true);
    try {
      // Come straight back to the account step of this form.
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/intake?resume=account`,
      });
      if (result.error) {
        toast.error("Google sign-in didn't complete. Try again or use email.");
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) {
        setAuthed(true);
        setAccountEmail(data.user.email);
        setState((s2) => ({ ...s2, workEmail: s2.workEmail || data.user!.email! }));
        toast.success("Signed in with Google. Your draft is safe.");
        continueAfterAccount();
      }
    } catch {
      toast.error("Google sign-in didn't complete. Try again or use email.");
    } finally {
      setAccountBusy(false);
    }
  };

  // After a full-page Google redirect, land back on the step that holds the
  // account block so the brief carries on from exactly where it paused.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!new URLSearchParams(window.location.search).has("resume")) return;
    setStepIndex(0);
    const t = setTimeout(() => {
      document.getElementById("account-step")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => clearTimeout(t);
  }, []);

  // Which step the client was on is part of the server-side draft, so it
  // survives a closed laptop rather than living in this browser only.



  /**
   * Asks for requirement suggestions from the pasted job description once the
   * client reaches step 2. Failure is non-fatal: the list still works by hand.
   */
  /**
   * Fills the fields the job description answered — and only those.
   *
   * The rule is the same one `applyDraftPayload` uses for a restored draft:
   * anything in `editedRef` is the client's own answer and is never touched.
   * On top of that, a field that already holds a value is left alone, so a
   * re-parse after an edit adds what is missing instead of overwriting what is
   * there. That is what makes re-parsing on every change safe (INT-012).
   *
   * `currency` and `compensationPeriod` are the two exceptions: they ship with
   * defaults ("USD", "year") that nobody chose, so a value read out of the JD
   * may replace them — until the client edits them, at which point the
   * editedRef guard takes over.
   */
  /**
   * The company website comes from the work email, not from a question.
   *
   * Step 1 used to ask for it outright — a field whose answer was already in
   * the address typed two rows above (audit 15 Sep, INT-001). Derived only
   * while the client has not set one themselves, and never for a free-mail
   * address, where the domain says nothing about the company.
   */
  useEffect(() => {
    if (editedRef.current.has("companyWebsite")) return;
    if (state.companyWebsite.trim().length > 0) return;
    const derived = companyWebsiteFromEmail(state.workEmail);
    if (!derived) return;
    setState((s) => (s.companyWebsite.trim() ? s : { ...s, companyWebsite: derived }));
  }, [state.workEmail, state.companyWebsite]);

  const applyBlueprint = React.useCallback((bp: JdBlueprint) => {
    const DEFAULTED = new Set(["currency", "compensationPeriod"]);
    setState((s) => {
      const next: Partial<FormState> = {};
      const put = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        if (editedRef.current.has(key as string)) return;
        const current = s[key];
        const isEmpty =
          current === "" || current === null || current === undefined ||
          (Array.isArray(current) && current.length === 0);
        if (!isEmpty && !DEFAULTED.has(key as string)) return;
        next[key] = value;
      };

      if (bp.title) put("roleTitle", bp.title.value);
      if (bp.location) put("location", bp.location.value);
      if (bp.workModel) put("workModel", bp.workModel.value);
      if (bp.seniority) put("seniority", bp.seniority.value);
      if (bp.employmentType) put("employmentType", bp.employmentType.value);
      if (bp.team) put("team", bp.team.value);
      if (bp.salaryMin) put("salaryMin", String(bp.salaryMin.value));
      if (bp.salaryMax) put("salaryMax", String(bp.salaryMax.value));
      if (bp.currency) put("currency", bp.currency.value);
      if (bp.compensationPeriod) put("compensationPeriod", bp.compensationPeriod.value);
      if (bp.targetStartDate) put("targetStartDate", bp.targetStartDate.value);
      // A description that states the employer will not sponsor answers the
      // visa question, so the client is not asked it twice (INT-015).
      if (bp.requiresExistingWorkAuth?.value === true) put("sponsorshipAvailable", "no");
      if (Object.keys(next).length === 0) return s;
      return { ...s, ...next };
    });
  }, []);

  /**
   * Reads the job description, however it arrived.
   *
   * One call for all three inputs: pasted text, an uploaded file, or a link.
   * Uploads used to be ignored entirely here — the file attached, nothing was
   * extracted, and the page still promised "upload the job description and
   * TaaSFlow will build the complete role blueprint" (audit 15 Sep, INT-010).
   *
   * Failure stays non-fatal: the list works by hand, exactly as before.
   */
  const runJdParse = React.useCallback(
    async (input: {
      text?: string;
      file?: { filename: string; mime: string; base64: string };
      url?: string;
      roleTitle: string;
    }) => {
      const requestId = ++jdRequestSeqRef.current;
      const sourceText = input.text?.trim() ?? null;
      setSuggestions({ kind: "loading" });
      try {
        const res = await fetch("/api/public/jd-requirements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleTitle: input.roleTitle,
            jobDescriptionText: input.text ?? "",
            file: input.file,
            url: input.url,
          }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          suggestions?: RequirementItem[];
          blueprint?: JdBlueprint;
          text?: string;
          message?: string;
        };
        // Ignore responses to an older JD, even if that request finishes last.
        // Manually edited fields are independently protected by editedRef.
        if (
          requestId !== jdRequestSeqRef.current ||
          (sourceText !== null && latestJdTextRef.current.trim() !== sourceText)
        ) return;
        if (!json.ok) {
          // A file we genuinely could not read is worth saying out loud; every
          // other failure stays quiet and the client just types.
          if (json.message) toast.error(json.message);
          setSuggestions({ kind: "idle" });
          return;
        }
        // Text read out of a file or a link becomes the draft's job
        // description, so it persists, submits and re-parses like pasted text.
        if (json.text && json.text.trim().length > 0) {
          setState((s) =>
            s.jobDescriptionText.trim().length > 0 ? s : { ...s, jobDescriptionText: json.text! },
          );
        }
        if (json.blueprint) applyBlueprint(json.blueprint);
        if (Array.isArray(json.suggestions) && json.suggestions.length > 0) {
          setSuggestions({ kind: "ready", items: json.suggestions });
        } else {
          setSuggestions({ kind: "idle" });
        }
      } catch {
        if (requestId === jdRequestSeqRef.current) {
          setSuggestions({ kind: "idle" });
        }
      }
    },
    [applyBlueprint],
  );

  /**
   * Re-reads the description whenever it changes, not only on a page reload.
   *
   * Keyed on the CONTENT, not its length: replacing a job description with a
   * different one of the same length used to leave the old suggestions in
   * place (INT-012/INT-016). Debounced so typing does not bill a model call
   * per keystroke.
   */
  useEffect(() => {
    // Start reading on the JD entry step, so the role fields can already be
    // filled when the client reaches the next step. Keep edits fully manual.
    if (stepIndex > 1) return;
    const jd = state.jobDescriptionText.trim();
    if (jd.length < MIN_JD_TEXT) {
      jdRequestSeqRef.current++;
      suggestedForRef.current = "";
      setSuggestions({ kind: "idle" });
      return;
    }
    const signature = `text:${state.roleTitle.trim()}::${jd}`;
    if (suggestedForRef.current === signature) return;
    const timer = window.setTimeout(() => {
      suggestedForRef.current = signature;
      void runJdParse({ text: jd, roleTitle: state.roleTitle });
    }, JD_REPARSE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [stepIndex, state.jobDescriptionText, state.roleTitle, runJdParse]);

  const setRequirements = (next: RequirementItem[]) => {
    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent("express_intake_started", { flow: "express_onboarding" });
    }
    editedRef.current.add("requirements");
    setState((s) => ({ ...s, requirements: next }));
    setErrors((e) => ({ ...e, requirements: "" }));
    setRowErrors({});
  };

  /** An example the client chose: appended as ordinary editable text. */
  /* --- Interview process editing ------------------------------------- */

  const setStages = (next: InterviewStage[]) => {
    setState((s) => ({ ...s, interviewStages: next }));
    setErrors((e) => ({ ...e, interviewStages: "" }));
    setCarriedFields((prev) => {
      if (!prev.has("interviewStages")) return prev;
      const nextSet = new Set(prev);
      nextSet.delete("interviewStages");
      return nextSet;
    });
  };

  const updateStage = (index: number, patch: Partial<InterviewStage>) => {
    setStages(state.interviewStages.map((s, i) => (i === index ? { ...s, ...patch } : s)));
    setStageErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const addStage = () => {
    if (state.interviewStages.length >= MAX_INTERVIEW_STAGES) return;
    setStages([
      ...state.interviewStages,
      { name: "", format: "video_call", ownerName: "", ownerEmail: "" },
    ]);
  };

  const removeStage = (index: number) => {
    setStages(state.interviewStages.filter((_, i) => i !== index));
    setStageErrors({});
  };

  /** The suggested three-stage process, accepted on purpose by the client. */
  const useStageTemplate = () => {
    setStages(DEFAULT_INTERVIEW_STAGE_TEMPLATE.map((s) => ({ ...s })));
    setStageErrors({});
  };

  /**
   * People the client named. Listed back to them so an invitation is always a
   * deliberate choice — nothing is sent from this screen.
   */
  const collaborators = React.useMemo(
    () =>
      collaboratorCandidates(state.interviewStages, {
        name: state.decisionMaker,
        email: state.decisionMakerEmail,
      }),
    [state.interviewStages, state.decisionMaker, state.decisionMakerEmail],
  );

  /**
   * Deal-breaker lines. Optional, validated inline, and never longer than five —
   * the same rules the server applies.
   */
  const dealBreakerIssues = React.useMemo(
    () => validateDealBreakers(state.dealBreakerList),
    [state.dealBreakerList],
  );
  // The field promises that anything tied to a protected characteristic is
  // removed before sourcing, and nothing enforced it: entries were stored
  // verbatim and shown back on the review screen as accepted rules
  // (audit 1 Sep, F12). Non-blocking on purpose — a false positive must never
  // stop a client submitting a role.
  const dealBreakerFlags = React.useMemo(
    () => screenDealBreakers(state.dealBreakerList),
    [state.dealBreakerList],
  );

  const setDealBreaker = (index: number, value: string) => {
    setState((s) => {
      const next = [...s.dealBreakerList];
      next[index] = value;
      return { ...s, dealBreakerList: next };
    });
  };

  const addDealBreaker = () => {
    setState((s) =>
      s.dealBreakerList.length >= MAX_DEAL_BREAKERS
        ? s
        : { ...s, dealBreakerList: [...s.dealBreakerList, ""] },
    );
  };

  const removeDealBreaker = (index: number) => {
    setState((s) => {
      const next = s.dealBreakerList.filter((_, i) => i !== index);
      return { ...s, dealBreakerList: next.length > 0 ? next : [""] };
    });
  };


  const useExample = (key: "dealBreakers" | "interviewProcess", text: string) => {

    setState((s) => {
      const current = (s[key] ?? "").trim();
      return { ...s, [key]: current.length > 0 ? `${current}\n${text}` : text };
    });
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  /**
   * A duplicate must be deliberate: either the title changes, or the client says
   * the identical title is intentional. And compensation copied from a brief
   * older than 180 days is checked before it goes back out to candidates.
   */
  const dupTitleUnchanged =
    duplicate !== null &&
    duplicate.sourceTitle !== null &&
    state.roleTitle.trim().toLowerCase() === duplicate.sourceTitle.trim().toLowerCase();
  const dupBlockers: string[] = [];
  if (dupTitleUnchanged && !dupTitleConfirmed) dupBlockers.push("Confirm or change the job title");
  if (duplicate?.compensationStale && !dupCompReviewed) {
    dupBlockers.push("Check the copied compensation is still right");
  }

  /**
   * Is this one answer good enough to stop calling it missing? Used to retire a
   * shown error the moment the answer becomes valid, so the "still needs your
   * answer" summary tracks what is on screen instead of the last Continue click.
   */
  const answerNowValid = (key: string, value: unknown, next: FormState): boolean => {
    if (key === "companyName" || key === "companyWebsite" || key === "firstName" || key === "lastName" || key === "workEmail") {
      const res = stepValidators.company.safeParse({
        companyName: next.companyName,
        companyWebsite: next.companyWebsite,
        firstName: next.firstName,
        lastName: next.lastName,
        workEmail: next.workEmail,
      });
      return res.success || !res.error.issues.some((i) => String(i.path[0] ?? "") === key);
    }
    if (key === "roleTitle") return stepValidators.role.safeParse({ roleTitle: next.roleTitle }).success;
    if (key === "jobDescriptionText") {
      return Boolean(jdFile) || next.jobDescriptionText.trim().length >= MIN_JD_TEXT;
    }
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined;
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    if (!startedRef.current) {
      startedRef.current = true;
      trackEvent("express_intake_started", { flow: "express_onboarding" });
    }
    editedRef.current.add(key as string);
    setState((s) => ({ ...s, [key]: value }));
    // Retire this field's error as soon as the answer holds up, so the summary
    // above Continue reflects the form as it is now.
    const nextState = { ...state, [key]: value } as FormState;
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      if (!answerNowValid(key as string, value, nextState)) return prev;
      const cleared = { ...prev };
      delete cleared[key as string];
      return cleared;
    });
    // An edited answer is this role's own answer, not an inherited one.
    setCarriedFields((prev) => {
      if (!prev.has(key as string)) return prev;
      const next = new Set(prev);
      next.delete(key as string);
      return next;
    });
  };

  /**
   * Compensation inputs take digits only. Anything else is rejected inline
   * instead of being silently swallowed, so nobody wonders where their "$" went.
   */
  const onSalaryChange = (key: "salaryMin" | "salaryMax", raw: string) => {
    const digits = raw.replace(/[^\d]/g, "");
    set(key, digits);
    setErrors((prev) => {
      const next = { ...prev };
      if (raw.trim() !== "" && digits !== raw.replace(/\s/g, "")) {
        next[key] = "Numbers only — no currency symbols, commas or text";
      } else {
        delete next[key];
      }
      // Re-open the wide-range confirmation whenever the numbers move.
      delete next.wideRangeConfirmed;
      return next;
    });
    setState((s) => ({ ...s, wideRangeConfirmed: false }));
  };

  /** Whether the current range trips the stated wide-range threshold. */
  const wideRange = isWideCompensationRange(
    Number(state.salaryMin) || 0,
    Number(state.salaryMax) || 0,
  );

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    const ext = jdFileExt(file.name);
    if (UNREADABLE_JD_EXT.has(ext)) {
      toast.error("Legacy .doc files can't be read. Save it as PDF or DOCX and upload again.");
      return;
    }
    if (!ALLOWED_JD_EXT.has(ext)) {
      toast.error("Upload a PDF, DOCX, TXT or RTF file.");
      return;
    }

    if (file.size > MAX_JD_BYTES) {
      toast.error("That file is larger than 10 MB.");
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      const mime = file.type || "application/octet-stream";
      setJdFile({ filename: file.name, mime, base64, size: file.size });
      setErrors((e) => ({ ...e, jobDescriptionText: "" }));
      trackEvent("job_description_selected", { flow: "express_onboarding", kind: ext });
      // Read it now. The file used to attach and sit there: nothing was
      // extracted, no field was filled, and the requirement suggestions kept
      // showing whatever had been pasted earlier (audit 15 Sep, INT-010).
      suggestedForRef.current = `file:${file.name}::${file.size}`;
      set("jdSourceName", file.name);
      void runJdParse({
        file: { filename: file.name, mime, base64 },
        roleTitle: state.roleTitle,
      });
    } catch {
      toast.error("We couldn't read that file. Try another one.");
    }
  };

  /**
   * The exact object submit sends, built from form state alone.
   *
   * Extracted so the review panel can validate the real payload rather than a
   * hand-copied subset of the rules. The review used to list only UNANSWERED
   * required fields, which structurally cannot describe a CONFLICT between two
   * fields that are both answered: with every listed item cleared the summary
   * read as complete and the submit button enabled, yet clicking it only
   * auto-saved, because "Not decided yet" was ticked while a salary range was
   * still filled in (audit 16 Sep, INT-001). Re-deriving the blockers from this
   * payload means the panel and the button can never disagree with submit —
   * they ask the same schema the same question.
   */
  const buildSubmitPayload = (idempotencyKey: string) => {
    // Blank rows the client added and never filled in are dropped, not sent.
    const submittedStages = state.interviewStages.filter(
      (s) => (s.name ?? "").trim().length > 0,
    );
    return {

      idempotencyKey,
      companyName: state.companyName,
      companyWebsite: state.companyWebsite,
      companyLinkedin: state.companyLinkedin,
      firstName: state.firstName,
      lastName: state.lastName,
      contactTitle: state.contactTitle,
      workEmail: state.workEmail,
      phone: state.phone,
      contactLinkedin: state.contactLinkedin,
      // Second line of defence for the same dead-end: an authed submitter has
      // no password step, so stale field values must never reach the schema.
      password: authed ? "" : state.password,
      confirmPassword: authed ? "" : state.confirmPassword,
      roleTitle: state.roleTitle,
      team: state.team,
      jobDescriptionText: state.jobDescriptionText,
      jobDescriptionFile: jdFile
        ? { filename: jdFile.filename, mime: jdFile.mime, base64: jdFile.base64 }
        : null,
      ...requirementsToLines(state.requirements),
      requirements: state.requirements,
      manyMustHavesConfirmed: state.manyMustHavesConfirmed,
      dealBreakers: normalizeDealBreakers(state.dealBreakerList).join("\n"),
      dealBreakerList: normalizeDealBreakers(state.dealBreakerList),

      location: state.location,
      workModel: state.workModel,
      // Read from the job description rather than asked. Employment type falls
      // back to full-time, which is what the overwhelming majority of briefs
      // are and what the publish gate needs to see; the admin can change it.
      seniority: state.seniority,
      employmentType: state.employmentType || "full_time",
      // Hidden fields submit nothing, not a stale earlier answer.
      onsiteDays:
        state.workModel === "hybrid" && state.onsiteDays !== ""
          ? Number(state.onsiteDays)
          : undefined,
      remoteTimezones: state.workModel === "remote" ? state.remoteTimezones : [],
      remoteAnywhereInCountry:
        state.workModel === "remote" ? state.remoteAnywhereInCountry : false,
      sponsorshipAvailable: state.sponsorshipAvailable,
      currency: state.currency,
      compensationPeriod: state.compensationPeriod,
      salaryMin: state.salaryMin === "" ? undefined : Number(state.salaryMin),
      salaryMax: state.salaryMax === "" ? undefined : Number(state.salaryMax),
      compensationNote: state.compensationNote,
      compensationUndecided: state.compensationUndecided,
      bonusStructure: state.bonusStructure,
      equity: state.equity,
      compensationFlexible: state.compensationFlexible,
      wideRangeConfirmed: state.wideRangeConfirmed,
      workAuthorization: state.workAuthorization,
      workAuthorizationNote: state.workAuthorizationNote,
      // The readable version of the structured stages, so every surface that
      // reads text keeps working. Never invented — empty stages, empty text.
      interviewProcess:
        submittedStages.length > 0
          ? interviewProcessSummary(
              submittedStages,
              state.targetDaysToOffer === "" ? null : Number(state.targetDaysToOffer),
            )
          : state.interviewProcess,
      interviewStages: submittedStages,
      targetDaysToOffer:
        state.targetDaysToOffer === "" ? undefined : Number(state.targetDaysToOffer),
      decisionMaker: state.decisionMaker,
      decisionMakerEmail: state.decisionMakerEmail,
      // Only true when the client ticked the box on this screen.
      inviteCollaborators: state.inviteCollaborators && collaborators.length > 0,

      targetStartDate: state.targetStartDate,

      consent: state.consent,
      pilotAcknowledgement: state.pilotAcknowledgement,
      researchConsent: state.researchConsent,
      source: "express_onboarding",
      companyFax: state.companyFax,
    };
  };

  /**
   * Everything that would stop submit RIGHT NOW, beyond the unanswered
   * required fields the review already names.
   *
   * Derived from the same schema the submit handler parses, so a rule can
   * never exist in one place and not the other — which is how the
   * compensation conflict came to block submit while appearing nowhere in the
   * review (INT-001). Fields already listed as missing are skipped so the
   * client sees each problem once.
   *
   * `placementErrors` and `processErrors` are pure reads of form state and are
   * applied by submit too, so they belong in the same list.
   */
  const submitBlockers = React.useMemo(() => {
    const proc = processErrors();
    return intakeSubmitBlockers(
      // A syntactically valid placeholder: the real key is minted at submit and
      // has no bearing on whether the brief itself is acceptable.
      buildSubmitPayload(idem.current || "intakereview01"),
      review.missing.map((m) => m.field),
      {
        ...placementErrors(),
        interviewStages:
          proc.listError ??
          (Object.keys(proc.rowErrors).length > 0 ? "Check your interview stages" : undefined),
        targetDaysToOffer: proc.targetError,
        decisionMakerEmail: proc.decisionMakerEmail,
      },
    );
    // `state`, `jdFile` and `authed` are what the payload and both error
    // helpers read; `review.missing` decides what is already named above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, jdFile, authed, review.missing]);

  const submit = async (intent: "pay" | "call" = PAYMENTS_ENABLED ? "pay" : "call") => {
    const payload = buildSubmitPayload(idem.current || newIdempotencyKey());

    const parsed = expressIntakeSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!next[key]) next[key] = issue.message;
      }
      // Object-level password checks only run once every field parses, so we
      // surface them here too — otherwise a mismatch stays invisible while
      // another field is still empty.
      if (!authed) {
        if (state.password && state.password.length < MIN_ACCOUNT_PASSWORD) {
          next.password = `Use at least ${MIN_ACCOUNT_PASSWORD} characters`;
        }
        if ((state.password ?? "") !== (state.confirmPassword ?? "")) {
          next.confirmPassword = "Both passwords must match";
        }
      }
      // Same class of problem for the job description: the length rule lives in
      // an object-level refine, so a too-short paste stayed invisible while any
      // other field was still empty.
      const jdTyped = (state.jobDescriptionText ?? "").trim();
      if (!jdFile && jdTyped.length > 0 && jdTyped.length < MIN_JD_TEXT) {
        next.jobDescriptionText = "Paste the job description or upload the file";
      }
      // Same for the two brief rules that live in object-level refines.
      if (
        state.salaryMin !== "" &&
        state.salaryMax !== "" &&
        Number(state.salaryMax) < Number(state.salaryMin)
      ) {
        next.salaryMax = "The top of the range must be at least the bottom";
      }
      if (
        isWideCompensationRange(Number(state.salaryMin) || 0, Number(state.salaryMax) || 0) &&
        !state.wideRangeConfirmed
      ) {
        next.wideRangeConfirmed = COMPENSATION_WIDE_RANGE_WARNING;
      }
      if (state.compensationUndecided && (state.salaryMin !== "" || state.salaryMax !== "")) {
        next.compensationUndecided = "Clear the range, or untick 'Not decided yet'";
      }
      Object.assign(next, placementErrors());
      {
        const proc = processErrors();
        setStageErrors(proc.rowErrors);
        if (proc.listError) next.interviewStages = proc.listError;
        if (proc.targetError) next.targetDaysToOffer = proc.targetError;
        if (proc.decisionMakerEmail) next.decisionMakerEmail = proc.decisionMakerEmail;
        for (const key of Object.keys(proc.rowErrors)) {
          next.interviewStages = next.interviewStages ?? "Check your interview stages";
          void key;
        }
      }



      setErrors(next);
      // Same reasoning as validateStep: name the first real problem rather than
      // pointing at a highlight that may be on another step entirely.
      toast.error(Object.values(next)[0] ?? "Please check the highlighted fields.");
      // Send the client to the step that actually holds the first problem,
      // rather than showing an error they cannot see.
      const badStep = INTAKE_STEPS.findIndex((s) =>
        STEP_FIELDS[s.key].some((f) => next[f]),
      );
      if (badStep >= 0 && badStep !== stepIndex) setStepIndex(badStep);
      focusFirstError();
      return;
    }
    setErrors({});
    setSubmitError(null);
    lastIntentRef.current = intent;
    setSubmitting(true);

    try {

      // A signed-in client proves ownership of the account with their bearer
      // token; the server refuses to touch an existing workspace without it.
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authed) {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch("/api/public/express-intake", {
        method: "POST",
        headers,
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) {
        // Keep every entered value; show one clear message with Retry.
        setSubmitError(body?.message || "We couldn't submit that. Nothing was lost — please retry.");
        setSubmitting(false);
        return;
      }



      trackFgv(FGV_EVENTS.formSubmit, { form_type: "employer_intake" });
      void submitToCrm({
        formId: "employer-intake",
        email: parsed.data.workEmail,
        fullName: `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
        phone: parsed.data.phone || null,
        jobTitle: parsed.data.contactTitle || null,
        linkedin: parsed.data.contactLinkedin || null,
        companyName: parsed.data.companyName || null,
        companyDomain: parsed.data.companyWebsite || null,
        answers: {
          "Role title": parsed.data.roleTitle ?? "",
          "Company website": parsed.data.companyWebsite ?? "",
          "Company LinkedIn": parsed.data.companyLinkedin ?? "",
          "Job description provided": parsed.data.jobDescriptionText ? "pasted" : jdFile ? "uploaded" : "none",
        },
        consentStatus: parsed.data.consent ? "accepted_terms" : null,
        honeypot: parsed.data.companyFax ?? "",
      }).then((result) => {
        if (result.ok) {
          trackConfirmedConversion({
            formType: "employer_intake",
            serviceInterest: "recruiting_subscription",
            destinationBrand: "taasflow",
            submissionId: result.submissionId,
          });
        } else {
          trackFgv(FGV_EVENTS.formError, {
            form_type: "employer_intake",
            error_code: result.error,
          });
        }
      });

      trackEvent("express_intake_submitted", {
        flow: "express_onboarding",
        pilot_eligible: body.pilotEligible !== false,
      });
      if (body.accountCreated) {
        trackEvent("account_created_from_intake", { flow: "express_onboarding" });
        trackDashboardSignup({ method: "email_password", plan: "express_onboarding" });
      }
      else trackEvent("existing_account_detected", { flow: "express_onboarding" });
      if (body.pilotEligible === false)
        trackEvent("pilot_ineligible", { reason: String(body.pilotReason ?? "unknown") });
      if (body.positionId) trackEvent("role_created", { flow: "express_onboarding" });
      if (jdFile)
        trackEvent(body.jdStored === false ? "document_upload_failed" : "document_upload_succeeded", {
          flow: "express_onboarding",
        });

      // Sign the client straight into their new workspace.
      let signedIn = authed;
      if (!authed && parsed.data.password) {
        try {
          const { error } = await supabase.auth.signInWithPassword({
            email: parsed.data.workEmail,
            password: parsed.data.password,
          });
          signedIn = !error;
        } catch {
          signedIn = false;
        }
      }

      // Kick off blueprint preparation. Deliberately not awaited — the role
      // page shows real progress while it runs.
      if (body.intakeId) {
        void fetch("/api/public/blueprint-run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intakeId: body.intakeId }),
        }).catch(() => undefined);
      }

      // The brief is in: mark the draft submitted so a stale tab can never
      // resurrect it, and clear the account copy.
      void markIntakeSubmitted(signedIn).catch(() => undefined);
      if (signedIn) void clearIntakeDraft().catch(() => undefined);
      try {
        localStorage.removeItem(EXPRESS_IDEMPOTENCY_KEY);
      } catch {
        /* ignore */
      }


      const proceed = () => {
        if (signedIn && body.positionId) {
          // Role stays a draft either way — payment (or a conversation) comes next.
          trackEvent("intake_path_chosen", { flow: "express_onboarding", path: intent });
          if (PAYMENTS_ENABLED && intent === "pay") {
            navigate({ to: "/checkout", search: { position: body.positionId } });
          } else {
            navigate({ to: "/book", search: { cta: "intake" } });
          }
          return;
        }
        navigate({ to: "/intake/confirmation", search: { intake_id: body.intakeId } });
      };

      // The pilot runs once per company. If it has already been used — including
      // under a different account — say so plainly before moving them on, rather
      // than letting them believe they are on a pilot.
      if (body.pilotEligible === false) {
        setPilotNotice(() => proceed);
        setSubmitting(false);
        return;
      }
      proceed();


    } catch {
      setSubmitError("We couldn't reach us just now. Your answers are safe — please retry.");
      setSubmitting(false);
    }

  };

  const jdChars = state.jobDescriptionText.trim().length;

  // Fire once when the client has genuinely pasted a description.
  useEffect(() => {
    if (jdChars >= MIN_JD_TEXT && !pastedRef.current) {
      pastedRef.current = true;
      trackEvent("job_description_pasted", { flow: "express_onboarding" });
    }
  }, [jdChars]);

  if (!hydrated) {
    return (
      <FormShell
        width="lg"
        eyebrow="Start hiring"
        title="Launch a role in minutes."
        description="Create your workspace and upload the job description. TaaSFlow will build the complete role blueprint, screening criteria, and sourcing plan for you."
      >
        <div className="space-y-4" aria-busy="true" data-testid="intake-loading">
          <p className="flex items-center gap-2 text-sm text-[color:var(--brand-navy)]/75">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Opening your form…
          </p>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-[color:var(--brand-navy)]/8"
            />
          ))}
        </div>
      </FormShell>
    );
  }

  return (
    <FormShell
      width="lg"
      eyebrow="Start hiring"
      title="Launch a role in minutes."
      description="Create your workspace and upload the job description. TaaSFlow will build the complete role blueprint, screening criteria, and sourcing plan for you."
    >
      <div
        className="space-y-6"
        id="form-main"
        // Leaving a field is the natural moment to checkpoint the answer.
        onBlur={() => {
          if (hydratedRef.current) queueSave();
        }}
      >
        {pilotNotice && (
          <div
            className="rounded-xl border border-amber-300 bg-amber-50 p-4"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-semibold text-amber-900">
              The pilot has already been used for your company.
            </p>
            <p className="mt-1 text-sm text-amber-900/80">{PILOT_INELIGIBLE_CLIENT_MESSAGE}</p>
            <Button
              type="button"
              className="mt-3"
              onClick={() => {
                const go = pilotNotice;
                setPilotNotice(null);
                go();
              }}
            >
              Continue
            </Button>
          </div>
        )}

        {PAYMENTS_ENABLED ? (
          <div className="rounded-xl border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-navy)]/4 p-4">
            <p className="text-sm font-semibold">
              No payment today. Nothing is charged to start.
            </p>
            <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">
              Create your workspace and share the role first. You only pay once your account is created
              and we've accepted the role — and you can walk away before that at no cost.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-navy)]/4 p-4">
            <p className="text-sm font-semibold">
              Free to start. Your workspace opens right away.
            </p>
            <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">
              Create your account, share the role, then pick a time. We agree the plan together on the call.
            </p>
          </div>
        )}

        {draftNotice && (
          <div
            className="rounded-xl border border-[color:var(--brand-navy)]/15 bg-white p-4 text-sm text-[color:var(--brand-navy)]/80"
            data-testid="draft-notice"
          >
            {draftNotice}
          </div>
        )}

        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[color:var(--brand-navy)]/75"
          aria-live="polite"
          data-testid="draft-status"
        >
          {draftPhase === "restoring" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {duplicateParam ? "Preparing your draft" : INTAKE_DRAFT_RESTORING_LABEL}…
            </>
          ) : saveError ? (
            <>
              <span className="text-[color:var(--brand-navy)]">{INTAKE_DRAFT_SAVE_ERROR_MESSAGE}</span>
              <button
                type="button"
                className="underline"
                onClick={() => void saveNow()}
                disabled={savingDraft}
              >
                Try saving now
              </button>
            </>
          ) : savingDraft ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Saving…
            </>
          ) : savedAt ? (
            <>
              <Check className="h-3.5 w-3.5 text-[color:var(--brand-teal)]" aria-hidden />
              {savedAtLabel(savedAt)}
              {authed ? " to your account" : " — you can close this and come back"}
            </>
          ) : (
            "We save your answers as you go, so you can leave and come back."
          )}
          {draftPhase === "ready" && !authed && (
            <>
              <span aria-hidden className="text-[color:var(--brand-navy)]/30">·</span>
              {resumeEmailState.kind === "sent" ? (
                <span>Link sent to {resumeEmailState.email}.</span>
              ) : (
                <button
                  type="button"
                  className="underline"
                  onClick={() => void sendResumeLink()}
                  disabled={resumeEmailState.kind === "sending"}
                  data-testid="email-resume-link"
                >
                  {resumeEmailState.kind === "sending" ? "Sending…" : "Email me a link back to this"}
                </button>
              )}
              {resumeEmailState.kind === "error" && (
                <span>We need a valid work email first — we could not send that link.</span>
              )}
            </>
          )}
        </div>


        {/* Step counter and an honest time estimate — not a fake "2 minutes". */}
        <nav aria-label="Intake progress" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">
              Step {stepIndex + 1} of {INTAKE_STEPS.length}: {currentStep.title}
            </p>
            <p className="text-xs text-[color:var(--brand-navy)]/70">
              About {minutesLeft} min left · {INTAKE_TOTAL_MINUTES} min in total
            </p>
          </div>
          <ol className="grid grid-cols-3 gap-2">
            {INTAKE_STEPS.map((s, i) => {
              const done = i < stepIndex;
              const current = i === stepIndex;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => goToStep(i)}
                    aria-current={current ? "step" : undefined}
                    className={`w-full rounded-md border px-2 py-2 text-left text-xs transition ${
                      current
                        ? "border-[color:var(--brand-navy)] bg-[color:var(--brand-navy)] text-white"
                        : done
                          ? "border-[color:var(--brand-teal)]/40 bg-[color:var(--brand-teal)]/8"
                          : "border-[color:var(--brand-navy)]/15 bg-white text-[color:var(--brand-navy)]/70"
                    }`}
                  >
                    <span className="block font-semibold">{i + 1}. {s.title}</span>
                    {!s.required && (
                      <span className={current ? "text-white/75" : "text-[color:var(--brand-navy)]/60"}>
                        Optional now
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/75">{currentStep.blurb}</p>
          {/* One legend per step — the only place requiredness is explained. */}
          <p className="text-xs text-[color:var(--brand-navy)]/70" data-testid="required-legend">
            {INTAKE_REQUIRED_LEGEND}
          </p>
        </nav>


        {carryCompany && (
          <div
            className="rounded-lg border border-[color:var(--brand-teal)]/40 bg-[color:var(--brand-teal)]/8 px-4 py-3 text-sm text-[color:var(--brand-navy)]"
            data-testid="carry-banner"
          >
            <p className="font-semibold">Another role for {carryCompany}</p>
            <p className="text-[color:var(--brand-navy)]/75">
              Your company, contact, location, process and package defaults are filled in already. Edit anything
              that differs for this role — it stays with this role only.
            </p>
          </div>
        )}

        {step === 1 && (
          <>
        <Section id="section-company" title="Your company" step={1}>

          <Field label="Company name" carried={isCarried("companyName")} error={errors.companyName} required={req["companyName"]}>
            <Input
              value={state.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              placeholder="Northwind Health"
              autoComplete="organization"
            />
          </Field>
          <details className="rounded-lg border border-[color:var(--brand-navy)]/12 bg-white px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">
              Add company LinkedIn{" "}
              <span className="font-normal text-[color:var(--brand-navy)]/60">— optional</span>
            </summary>
            <div className="mt-3">
              <Field label="Company LinkedIn" carried={isCarried("companyLinkedin")} error={errors.companyLinkedin} required={req["companyLinkedin"]}>
                <Input
                  value={state.companyLinkedin}
                  onChange={(e) => set("companyLinkedin", e.target.value)}
                  placeholder="linkedin.com/company/northwind"
                  inputMode="url"
                />
              </Field>
            </div>
          </details>

        </Section>

        <Section id="section-you" title="You" step={1}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" carried={isCarried("firstName")} error={errors.firstName} required={req["firstName"]}>
              <Input
                value={state.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                autoComplete="given-name"
              />
            </Field>
            <Field label="Last name" carried={isCarried("lastName")} error={errors.lastName} required={req["lastName"]}>
              <Input
                value={state.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                autoComplete="family-name"
              />
            </Field>
          </div>
          <Field label="Work email" carried={isCarried("workEmail")} error={errors.workEmail} required={req["workEmail"]}>
            <Input
              type="email"
              value={state.workEmail}
              onChange={(e) => {
                set("workEmail", e.target.value);
                setEmailStatus({ kind: "idle" });
              }}
              onBlur={() => void checkEmail()}
              autoComplete="email"
              inputMode="email"
            />
          </Field>
          <details className="rounded-lg border border-[color:var(--brand-navy)]/12 bg-white px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">
              Add your job title, phone and LinkedIn{" "}
              <span className="font-normal text-[color:var(--brand-navy)]/60">— optional</span>
            </summary>
            <div className="mt-3">
              <Field label="Your job title" carried={isCarried("contactTitle")} error={errors.contactTitle} required={req["contactTitle"]}>
                <Input
                  value={state.contactTitle}
                  onChange={(e) => set("contactTitle", e.target.value)}
                  placeholder="Head of Talent"
                  autoComplete="organization-title"
                />
              </Field>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Phone" carried={isCarried("phone")} error={errors.phone} required={req["phone"]}>
                <Input
                  value={state.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                />
              </Field>
              <Field label="Your LinkedIn" carried={isCarried("contactLinkedin")} error={errors.contactLinkedin} required={req["contactLinkedin"]}>
                <Input
                  value={state.contactLinkedin}
                  onChange={(e) => set("contactLinkedin", e.target.value)}
                  placeholder="linkedin.com/in/yourname"
                  inputMode="url"
                />
              </Field>
            </div>
          </details>

        </Section>

        <div id="account-step">
        {authed ? (
          <section className="flex items-center gap-3 rounded-xl border border-[color:var(--brand-teal)]/30 bg-[color:var(--brand-teal)]/5 p-4">
            <Check className="h-5 w-5 shrink-0 text-[color:var(--brand-teal)]" aria-hidden />
            <p className="text-sm">
              Signed in as <strong>{accountEmail}</strong>. This role will be added to your existing
              organisation, and your answers are saved to your account as you type.
            </p>
          </section>
        ) : (
        <Section title="Create your account" step={1}>
          <p className="text-sm text-[color:var(--brand-navy)]/70">
            Create it now and nothing you've typed can be lost — you stay on this page the whole time.
          </p>

          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            disabled={accountBusy}
            onClick={() => void googleSignIn()}
          >
            Continue with Google
          </Button>

          {emailStatus.kind === "exists" && (
            <div className="rounded-lg border border-[color:var(--brand-navy)]/15 bg-[color:var(--brand-navy)]/4 p-3 text-sm">
              {emailStatus.message}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Password"
              htmlFor="account-password"
              error={errors.password}
              required={req["password"]}
              hint={signInMode ? "The password for your existing account." : `At least ${MIN_ACCOUNT_PASSWORD} characters.`}
            >
              <div className="relative">
                <Input
                  id="account-password"
                  type={showPassword ? "text" : "password"}
                  value={state.password}
                  onChange={(e) => set("password", e.target.value)}
                  autoComplete={signInMode ? "current-password" : "new-password"}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-[color:var(--brand-navy)]/75 sm:h-9 sm:w-9 hover:text-[color:var(--brand-navy)]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </Field>
            {!signInMode && (
              <Field
                label="Confirm password"
                error={errors.confirmPassword}
                required={req["confirmPassword"]}
                hint="Type it once more so we know it's right."
              >
                <Input
                  type={showPassword ? "text" : "password"}
                  value={state.confirmPassword}
                  onChange={(e) => set("confirmPassword", e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={accountBusy}
              onClick={() => void (signInMode ? signInInline() : createAccountInline())}
            >
              {accountBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Working…
                </>
              ) : signInMode ? (
                "Sign in and continue"
              ) : (
                "Create my account now (optional)"
              )}
            </Button>
            <button
              type="button"
              className="text-sm underline text-[color:var(--brand-navy)]/70"
              onClick={() => setSignInMode((v) => !v)}
            >
              {signInMode ? "I don't have an account yet" : "I already have an account"}
            </button>
          </div>
          <p className="text-sm text-[color:var(--brand-navy)]/70">
            You don't have to do this now — <strong>Continue</strong> at the bottom of this step is the
            way forward, and we'll set the account up as you go.
          </p>
          <p className="text-sm text-[color:var(--brand-navy)]/70">
            Prefer the full login screen?{" "}
            <a href="/login" className="underline">
              Sign in first
            </a>{" "}
            and come back — your answers stay saved.
          </p>

        </Section>
        )}
        </div>
          </>
        )}



        {step === 1 && (
        <Section id="section-jd" title="The job description" step={1}>
          <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
            Give us the description and we read the role out of it — the title, the
            requirements, where it sits, what it pays. You confirm it on the next screen.
          </p>
          <div className="space-y-3">
            <div className="flex items-baseline">
              <Label htmlFor="jd-text" className="text-sm font-medium">
                Job description
              </Label>
              {req["jobDescriptionText"] ? (
                <span className="ml-1 text-sm text-[color:var(--brand-navy)]/70" aria-hidden="true">
                  *
                </span>
              ) : (
                <span className="ml-2 text-xs font-normal text-[color:var(--brand-navy)]/60">
                  Optional
                </span>
              )}
            </div>
            {!jdFile && state.jdSourceName && state.jobDescriptionText.trim().length > 0 && (
              <p className="rounded-lg border border-[color:var(--brand-navy)]/15 bg-white p-3 text-xs text-[color:var(--brand-navy)]/80">
                Read from <span className="font-medium">{state.jdSourceName}</span>. The text is
                saved with your draft and shown below — re-upload the file only if it has changed.
              </p>
            )}
            {jdFile ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--brand-navy)]/15 bg-white p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-[color:var(--brand-navy)]/75" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{jdFile.filename}</p>
                    <p className="text-xs text-[color:var(--brand-navy)]/75">
                      {(jdFile.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    onClick={() => fileInput.current?.click()}
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setJdFile(null)}
                    aria-label="Remove file"
                    className="min-h-11"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void onPickFile(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`flex min-h-[104px] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-white p-4 text-center transition ${
                  dragging
                    ? "border-[color:var(--brand-teal)] bg-[color:var(--brand-teal)]/5"
                    : "border-[color:var(--brand-navy)]/25 hover:border-[color:var(--brand-navy)]/50"
                }`}
              >
                <Upload className="h-5 w-5 text-[color:var(--brand-navy)]/75" aria-hidden />
                <span className="text-sm font-medium">Drop the job description here, or browse</span>
                <span className="text-xs text-[color:var(--brand-navy)]/75">
                  {JD_ACCEPT_LABEL}
                </span>
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              aria-label="Upload the job description file"
              accept={JD_ACCEPT_ATTR}
              className="sr-only"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />

            <div className="relative">
              <MarkdownToolbar
                textareaRef={jdTextRef}
                value={state.jobDescriptionText}
                onChange={(next) => set("jobDescriptionText", next)}
              />
              <Textarea
                id="jd-text"
                ref={jdTextRef}
                value={state.jobDescriptionText}
                onChange={(e) => set("jobDescriptionText", e.target.value)}
                onKeyDown={jdShortcuts}
                rows={8}
                className="rounded-t-none"
                placeholder={
                  jdFile
                    ? "Anything else we should know about this role (optional)…"
                    : "…or paste the job description here."
                }
                aria-invalid={Boolean(errors.jobDescriptionText)}
                aria-describedby={errors.jobDescriptionText ? "intake-jobDescriptionText-error" : undefined}
              />
              {!jdFile && (
                <p className="mt-1 text-xs text-[color:var(--brand-navy)]/75">
                  Paste the job description, upload the file, or paste a link to it.
                </p>
              )}

            </div>
            {/* The third way in. A client whose role is already posted on
                LinkedIn, Indeed or their own careers page has the description
                at a URL, and retyping it is work we can do for them (audit
                15 Sep, INT-014). Never required, and a site that blocks us
                falls back to pasting without losing anything already entered. */}
            <div className="space-y-1.5">
              <Label htmlFor="jd-url" className="text-xs">
                Or paste a link to the job posting
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="jd-url"
                  type="url"
                  inputMode="url"
                  value={jdUrl}
                  onChange={(e) => setJdUrl(e.target.value)}
                  placeholder="https://…"
                  className="min-w-0 flex-1"
                  aria-describedby="jd-url-help"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={!jdUrl.trim() || suggestions.kind === "loading"}
                  onClick={() => {
                    const url = jdUrl.trim();
                    if (!url) return;
                    suggestedForRef.current = `url:${url}`;
                    set("jdSourceName", url);
                    void runJdParse({ url, roleTitle: state.roleTitle });
                  }}
                >
                  {suggestions.kind === "loading" ? "Reading…" : "Read the link"}
                </Button>
              </div>
              <p id="jd-url-help" className="text-xs text-[color:var(--brand-navy)]/75">
                We read the page and fill in what it says. If the site blocks us, paste the text
                instead.
              </p>
            </div>
            {errors.jobDescriptionText && (
              <p id="intake-jobDescriptionText-error" data-field-error="true" className="text-sm text-[color:var(--brand-danger)]">
                {errors.jobDescriptionText}
              </p>
            )}
          </div>
        </Section>
        )}

        {step === 2 && (
        <Section id="section-role" title="The role" step={2}>
          {/* Only a free-mail address gets asked this. A company domain
              already answered it on step 1 without a question being put
              (audit 15 Sep, INT-001). */}
          {!companyWebsiteFromEmail(state.workEmail) && (
            <Field
              label="Company website"
              carried={isCarried("companyWebsite")}
              error={errors.companyWebsite}
              required={req["companyWebsite"]}
              hint="Your email domain did not tell us this one. We read only your public pages."
            >
              <Input
                value={state.companyWebsite}
                onChange={(e) => set("companyWebsite", e.target.value)}
                placeholder="northwindhealth.com"
                autoComplete="url"
                inputMode="url"
              />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={intakeFieldLabel("roleTitle")} error={errors.roleTitle} required={req["roleTitle"]}>
              <Input
                value={state.roleTitle}
                onChange={(e) => set("roleTitle", e.target.value)}
                placeholder="Clinical Operations Manager"
              />
            </Field>
            <Field label={intakeFieldLabel("team")} error={errors.team} required={req["team"]} hint={intakeFieldHint("team")}>
              <Input
                value={state.team}
                onChange={(e) => set("team", e.target.value)}
                placeholder="Clinical Operations"
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Seniority level" required={false}>
              <select
                aria-label="Seniority level"
                value={state.seniority}
                onChange={(e) => set("seniority", e.target.value)}
                className="flex h-11 w-full rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-3 text-sm"
              >
                <option value="">Not stated in the job description</option>
                {BLUEPRINT_SENIORITY.map((level) => (
                  <option key={level} value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
                ))}
              </select>
            </Field>
            <Field label="Employment type" required={false}>
              <select
                aria-label="Employment type"
                value={state.employmentType}
                onChange={(e) => set("employmentType", e.target.value as FormState["employmentType"])}
                className="flex h-11 w-full rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-3 text-sm"
              >
                <option value="">Not stated in the job description</option>
                {EMPLOYMENT_TYPES.map((kind) => (
                  <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>
                ))}
              </select>
            </Field>
          </div>
          {suggestions.kind === "loading" && (
            <p role="status" className="mt-3 text-sm text-[color:var(--brand-navy)]/70">
              Reading the job description. Any details we find will appear here automatically; you can edit them.
            </p>
          )}


        </Section>
        )}

        {step === 2 && (
        <Section id="section-people" title="Who you need" step={2}>
          <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
            One list. Tag each requirement so sourcing chases the right people instead of a wish list.
          </p>
          <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
            Each additional must-have narrows the search, so the more you add, the fewer eligible candidates there will be.
          </p>

          <SectionGroup title="Requirements">
            <RequirementsList
              items={state.requirements}
              onChange={setRequirements}
              rowErrors={rowErrors}
              listError={errors.requirements || null}
              needsConfirm={
                validateRequirements(state.requirements, {
                  manyConfirmed: state.manyMustHavesConfirmed,
                }).needsConfirm
              }
              manyConfirmed={state.manyMustHavesConfirmed}
              onConfirmMany={(confirmed) => {
                set("manyMustHavesConfirmed", confirmed);
                if (confirmed) setErrors((e) => ({ ...e, requirements: "" }));
              }}
              roleTitle={state.roleTitle}
              suggestions={suggestions}
              onRetrySuggestions={() => {
                // Re-analyse reads whatever the client gave us, in the same
                // order the parser does: an attached file first, then the text.
                suggestedForRef.current = "";
                if (jdFile) {
                  void runJdParse({
                    file: { filename: jdFile.filename, mime: jdFile.mime, base64: jdFile.base64 },
                    roleTitle: state.roleTitle,
                  });
                  return;
                }
                const jd = state.jobDescriptionText.trim();
                if (jd.length < MIN_JD_TEXT) return;
                void runJdParse({ text: jd, roleTitle: state.roleTitle });
              }}
            />
            {/* The example helper belongs INSIDE Requirements. As its own
                section it read as a second requirements question and made the
                step look twice as long as it is. */}
            <FieldExamples
              field="must_haves"
              roleTitle={state.roleTitle}
              label="See an example must-have"
              onUse={(text) =>
                setRequirements([...state.requirements, { text, tag: "must_have" }])
              }
            />
          </SectionGroup>
        </Section>
        )}

        {step === 3 && (
        <Section id="section-practicalities" title="Practicalities" step={3}>
          <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
            Money, place, authorisation, timing. If you do not have an answer yet, leave it — the role
            will simply be marked <span className="font-medium">Brief incomplete</span> until you do.
          </p>

          <SectionGroup title="Location and working model">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={intakeFieldLabel("location")} carried={isCarried("location")}
                error={errors.location}
                required={req["location"]}
                hint="City and country, or the region candidates must live in."
              >
                <Input
                  value={state.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Manchester, United Kingdom"
                />
              </Field>
              <Field label={intakeFieldLabel("workModel")} carried={isCarried("workModel")} error={errors.workModel} required={req["workModel"]} htmlFor="work-model">
                <select
                  id="work-model"
                  value={state.workModel}
                  onChange={(e) => onWorkModelChange(e.target.value as FormState["workModel"])}
                  className="flex h-11 w-full rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-3 text-sm"
                  aria-invalid={Boolean(errors.workModel)}
                aria-describedby={errors.workModel ? "intake-workModel-error" : undefined}
                >
                  <option value="">Choose one</option>
                  {WORK_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {WORK_MODEL_LABELS[m]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Hybrid is the only model that needs a day count. */}
            {state.workModel === "hybrid" && (
              <Field
                label="Days on site each week" carried={isCarried("onsiteDays")}
                error={errors.onsiteDays}
                required={req["onsiteDays"]}
                hint="Between 1 and 5. Candidates ask this first, and a wrong guess costs you offers."
              >
                <Input
                  value={state.onsiteDays}
                  onChange={(e) => set("onsiteDays", e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="3"
                />
              </Field>
            )}

            {/* Remote roles need a boundary: timezone bands, or the whole country. */}
            {state.workModel === "remote" && (
              <fieldset className="space-y-3 rounded-lg border border-[color:var(--brand-navy)]/12 bg-white p-4">
                <legend className="text-sm font-medium">
                  Acceptable timezones
                  {req["remoteTimezones"] ? (
                    <span aria-hidden="true" className="ml-1 text-[color:var(--brand-danger)]">
                      *
                    </span>
                  ) : (
                    <span className="ml-2 text-xs font-normal text-[color:var(--brand-navy)]/60">
                      Optional
                    </span>
                  )}
                </legend>
                <p className="text-sm text-[color:var(--brand-navy)]/75">
                  Pick the working-hours bands you can live with, or say anywhere in the country.
                </p>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={state.remoteAnywhereInCountry}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setState((s) => ({
                        ...s,
                        remoteAnywhereInCountry: on,
                        remoteTimezones: on ? [] : s.remoteTimezones,
                      }));
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.remoteTimezones;
                        return next;
                      });
                    }}
                  />
                  <span>Anywhere in the country — timezone does not matter</span>
                </label>
                {!state.remoteAnywhereInCountry && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TIMEZONE_BANDS.map((tz) => (
                      <label key={tz.value} className="flex cursor-pointer items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={state.remoteTimezones.includes(tz.value)}
                          onChange={() => toggleTimezone(tz.value)}
                        />
                        <span>{tz.label}</span>
                      </label>
                    ))}
                  </div>
                )}
                {errors.remoteTimezones && (
                  <p id="intake-remoteTimezones-error" data-field-error="true" className="text-sm text-[color:var(--brand-danger)]">
                    {errors.remoteTimezones}
                  </p>
                )}
              </fieldset>
            )}
          </SectionGroup>

          <SectionGroup title="Visa sponsorship">
            <fieldset
              className={`space-y-2 rounded-lg border p-4 ${
                errors.sponsorshipAvailable
                  ? "border-[color:var(--brand-danger)] bg-[color:var(--brand-danger)]/5"
                  : "border-[color:var(--brand-navy)]/12 bg-white"
              }`}
            >
              <legend className="text-sm font-medium">
                Can you sponsor a visa?
                <span aria-hidden="true" className="ml-1 text-[color:var(--brand-danger)]">
                  *
                </span>
              </legend>
              <p className="text-sm text-[color:var(--brand-navy)]/75">
                {SPONSORSHIP_WHY_IT_MATTERS}
              </p>
              {SPONSORSHIP_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-[color:var(--brand-navy)]/15 bg-white p-3"
                >
                  <input
                    type="radio"
                    name="sponsorship-available"
                    value={opt.value}
                    checked={state.sponsorshipAvailable === opt.value}
                    onChange={() =>
                      setState((s) => ({
                        ...s,
                        sponsorshipAvailable: opt.value,
                        // Work authorisation is the same answer in other words,
                        // so it is derived rather than asked twice.
                        workAuthorization:
                          opt.value === "yes" ? "will_sponsor" : "already_authorized",
                      }))
                    }
                    className="mt-1"
                  />
                  <span className="text-sm leading-relaxed">
                    <span className="font-medium">{opt.label}</span>
                    <span className="block text-xs text-[color:var(--brand-navy)]/75">{opt.hint}</span>
                  </span>
                </label>
              ))}
              {errors.sponsorshipAvailable && (
                <p id="intake-sponsorshipAvailable-error" data-field-error="true" className="text-sm text-[color:var(--brand-danger)]">
                  {errors.sponsorshipAvailable}
                </p>
              )}
            </fieldset>
          </SectionGroup>

          <SectionGroup title="Compensation">
            <div className="space-y-3 rounded-lg border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-navy)]/3 p-4">
              <p className="text-sm text-[color:var(--brand-navy)]/75">{COMPENSATION_HONEST_LINE}</p>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label={intakeFieldLabel("currency")} carried={isCarried("currency")} htmlFor="currency">
                  <select
                    id="currency"
                    value={state.currency}
                    onChange={(e) => set("currency", e.target.value)}
                    className="flex h-11 w-full rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-3 text-sm"
                  >
                    {COMP_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={intakeFieldLabel("salaryMin")} error={errors.salaryMin} required={req["salaryMin"]}>
                  <Input
                    value={state.salaryMin}
                    disabled={state.compensationUndecided}
                    onChange={(e) => onSalaryChange("salaryMin", e.target.value)}
                    inputMode="numeric"
                    placeholder="70000"
                  />
                </Field>
                <Field label={intakeFieldLabel("salaryMax")} error={errors.salaryMax} required={req["salaryMax"]}>
                  <Input
                    value={state.salaryMax}
                    disabled={state.compensationUndecided}
                    onChange={(e) => onSalaryChange("salaryMax", e.target.value)}
                    inputMode="numeric"
                    placeholder="85000"
                  />
                </Field>
                <Field label={intakeFieldLabel("compensationPeriod")} carried={isCarried("compensationPeriod")} htmlFor="comp-period">
                  <select
                    id="comp-period"
                    value={state.compensationPeriod}
                    onChange={(e) => set("compensationPeriod", e.target.value)}
                    className="flex h-11 w-full rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-3 text-sm"
                  >
                    {COMP_PERIODS.map((p) => (
                      <option key={p} value={p}>
                        {COMP_PERIOD_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Wide-range confirmation: it goes through, but on purpose. */}
              {wideRange && (
                <div
                  className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3"
                  data-field="wideRangeConfirmed"
                >
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={state.wideRangeConfirmed}
                      onChange={(e) => set("wideRangeConfirmed", e.target.checked)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>{COMPENSATION_WIDE_RANGE_WARNING}</span>
                  </label>
                  {errors.wideRangeConfirmed && !state.wideRangeConfirmed && (
                    <p className="text-sm text-red-600" data-field-error="true">
                      {errors.wideRangeConfirmed}
                    </p>
                  )}
                </div>
              )}

              {/* "Not decided yet" is recorded as undecided, never as zero. */}
              <div className="space-y-1" data-field="compensationUndecided">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={state.compensationUndecided}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setState((prev) => ({
                        ...prev,
                        compensationUndecided: on,
                        salaryMin: on ? "" : prev.salaryMin,
                        salaryMax: on ? "" : prev.salaryMax,
                        wideRangeConfirmed: on ? false : prev.wideRangeConfirmed,
                      }));
                      setErrors((prev) => {
                        const nextErrors = { ...prev };
                        delete nextErrors.salaryMin;
                        delete nextErrors.salaryMax;
                        delete nextErrors.compensationUndecided;
                        delete nextErrors.wideRangeConfirmed;
                        return nextErrors;
                      });
                    }}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    Not decided yet
                    <span className="block text-[color:var(--brand-navy)]/65">
                      We will record this as undecided and mark the brief incomplete for compensation.
                    </span>
                  </span>
                </label>
                {errors.compensationUndecided && (
                  <p id="intake-compensationUndecided-error" className="text-sm text-red-600" data-field-error="true">
                    {errors.compensationUndecided}
                  </p>
                )}
              </div>

              <Field label="Equity" carried={isCarried("equity")} htmlFor="comp-equity" required={req["equity"]}>
                <select
                  id="comp-equity"
                  value={state.equity}
                  onChange={(e) => set("equity", e.target.value)}
                  className="flex h-11 w-full rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-3 text-sm"
                >
                  <option value="">Not stated</option>
                  {COMP_EQUITY.map((k) => (
                    <option key={k} value={k}>
                      {COMP_EQUITY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </Field>

              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={state.compensationFlexible}
                  onChange={(e) => set("compensationFlexible", e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>Flexible for the right person</span>
              </label>

              <Field
                label="Anything else about the package"
                error={errors.compensationNote}
                required={req["compensationNote"]}
                hint="Bonus, relocation, shift premium, or where exactly you have room."
              >
                <Input
                  value={state.compensationNote}
                  onChange={(e) => set("compensationNote", e.target.value)}
                  placeholder="10% annual bonus; can stretch to 90k for someone exceptional"
                />
              </Field>
            </div>
          </SectionGroup>

          {/* No "Start date" group heading above a field labelled "Ideal start
              date": one field does not need a group, and the two together
              simply said the same thing twice. */}
          <SectionGroup title={intakeFieldLabel("startDate")}>
            <Field
              label="When would you like them to start?"
              error={errors.targetStartDate}
              required={req["targetStartDate"]}
            >
              <Input
                type="date"
                value={state.targetStartDate}
                onChange={(e) => set("targetStartDate", e.target.value)}
              />
            </Field>
          </SectionGroup>
        </Section>
        )}

        {step === 3 && (
        <Section id="section-process" title="Process and confirm" step={3}>
          <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
            How you decide, and what rules someone out. Two minutes here saves candidates dropping
            out halfway.
          </p>

          <SectionGroup title="What rules someone out?">
            <fieldset className="space-y-3" data-field="dealBreakerList">
              <legend className="sr-only">What would rule someone out?</legend>
              <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                {DEAL_BREAKER_WHY_IT_MATTERS}
              </p>
              <p className="text-xs leading-relaxed text-[color:var(--brand-navy)]/60">
                {DEAL_BREAKER_POLICY_LINE}
              </p>

              <div className="space-y-2">
                {state.dealBreakerList.map((line, index) => {
                  const rowError = dealBreakerIssues.rowErrors[index];
                  return (
                    <div key={index}>
                      <div className="flex items-start gap-2">
                        <Input
                          value={line}
                          maxLength={MAX_DEAL_BREAKER_CHARS}
                          onChange={(e) => setDealBreaker(index, e.target.value)}
                          placeholder={
                            index === 0
                              ? "No agency-side-only backgrounds"
                              : index === 1
                                ? "Cannot start within six weeks"
                                : "No hands-on ownership of the core system"
                          }
                          aria-label={`Deal-breaker ${index + 1}`}
                          aria-invalid={Boolean(rowError)}
                        />
                        {state.dealBreakerList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeDealBreaker(index)}
                            className="mt-2 text-xs underline text-[color:var(--brand-navy)]/70"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {rowError && (
                        <p
                          data-field-error="true"
                          className="mt-1 text-xs text-[color:var(--brand-danger)]"
                        >
                          {rowError}
                        </p>
                      )}
                      {dealBreakerFlags[index] && (
                        <p
                          role="status"
                          className="mt-1 rounded-md border border-dashed px-2 py-1.5 text-xs leading-relaxed text-[color:var(--brand-navy)]/75"
                        >
                          <span className="font-medium">Will not be used. </span>
                          {dealBreakerFlags[index]!.message}
                          {dealBreakerFlags[index]!.suggestion
                            ? ` ${dealBreakerFlags[index]!.suggestion}`
                            : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {dealBreakerIssues.listError && (
                <p data-field-error="true" className="text-sm text-[color:var(--brand-danger)]">
                  {dealBreakerIssues.listError}
                </p>
              )}

              {normalizeDealBreakers(state.dealBreakerList).length === 0 && (
                <p className="text-xs leading-relaxed text-[color:var(--brand-navy)]/60">
                  {DEAL_BREAKER_EMPTY_HINT}
                </p>
              )}

              {state.dealBreakerList.length < MAX_DEAL_BREAKERS ? (
                <Button type="button" variant="outline" size="sm" onClick={addDealBreaker}>
                  Add another
                </Button>
              ) : (
                <p className="text-xs text-[color:var(--brand-navy)]/60">
                  Five is the most we record — beyond that it stops being a filter.
                </p>
              )}
            </fieldset>
          </SectionGroup>

          <SectionGroup title="Your interview process">
            <fieldset className="space-y-3" data-field="interviewStages">
              <legend className="sr-only">Your interview process</legend>
              <p className="text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                {INTERVIEW_PROCESS_WHY_IT_MATTERS}
              </p>
              {isCarried("interviewStages") && (
                <p className="text-xs text-[color:var(--brand-navy)]/70">{CARRY_NOTICE}</p>
              )}

              {state.interviewStages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[color:var(--brand-navy)]/25 bg-white p-4">
                  <p className="text-sm font-medium">Most clients run three stages</p>
                  <p className="mt-1 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                    {DEFAULT_INTERVIEW_STAGE_TEMPLATE.map((s) => s.name).join(" → ")}. Use it as a
                    starting point, or build your own — nothing is saved until you choose.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={useStageTemplate}>
                      Use this as a starting point
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={addStage}>
                      Build my own
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-[color:var(--brand-navy)]">Stages</h4>
                  {state.interviewStages.map((stage, index) => {
                    const issues = stageErrors[index] ?? {};
                    return (
                      <div
                        key={index}
                        className="rounded-lg border border-[color:var(--brand-navy)]/15 bg-white p-4"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-[color:var(--brand-navy)]/10 pb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--brand-navy)]/70">
                            Stage {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeStage(index)}
                            className="text-xs underline text-[color:var(--brand-navy)]/70"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs">What is this stage?</Label>
                            <Input
                              value={stage.name}
                              maxLength={MAX_STAGE_NAME_CHARS}
                              onChange={(e) => updateStage(index, { name: e.target.value })}
                              placeholder="Hiring manager interview"
                              aria-invalid={Boolean(issues.name)}
                            />
                            {issues.name && (
                              <p
                                data-field-error="true"
                                className="mt-1 text-xs text-[color:var(--brand-danger)]"
                              >
                                {issues.name}
                              </p>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs">Format</Label>
                            <select
                              value={stage.format}
                              onChange={(e) =>
                                updateStage(index, {
                                  format: e.target.value as InterviewStage["format"],
                                })
                              }
                              className="h-10 w-full rounded-md border border-[color:var(--brand-navy)]/20 bg-white px-3 text-sm"
                            >
                              {INTERVIEW_STAGE_FORMATS.map((f) => (
                                <option key={f} value={f}>
                                  {INTERVIEW_STAGE_FORMAT_LABELS[f]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs">Who runs it?</Label>
                            <Input
                              value={stage.ownerName ?? ""}
                              onChange={(e) => updateStage(index, { ownerName: e.target.value })}
                              placeholder="Dana Okoro"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Their email</Label>
                            <Input
                              type="email"
                              value={stage.ownerEmail ?? ""}
                              onChange={(e) => updateStage(index, { ownerEmail: e.target.value })}
                              placeholder="dana@company.com"
                              aria-invalid={Boolean(issues.ownerEmail)}
                            />
                            {issues.ownerEmail && (
                              <p
                                data-field-error="true"
                                className="mt-1 text-xs text-[color:var(--brand-danger)]"
                              >
                                {issues.ownerEmail}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {state.interviewStages.length < MAX_INTERVIEW_STAGES ? (
                    <Button type="button" variant="outline" size="sm" onClick={addStage}>
                      Add a stage
                    </Button>
                  ) : (
                    <p className="text-xs text-[color:var(--brand-navy)]/60">
                      Five stages is the most we record — beyond that candidates drop out.
                    </p>
                  )}
                </div>
              )}
              {errors.interviewStages && (
                <p id="intake-interviewStages-error" data-field-error="true" className="text-sm text-[color:var(--brand-danger)]">
                  {errors.interviewStages}
                </p>
              )}
            </fieldset>
          </SectionGroup>

          <SectionGroup title="Timeline">
            <Field
              label={intakeFieldLabel("targetDaysToOffer")} carried={isCarried("targetDaysToOffer")}
              error={errors.targetDaysToOffer}
              required={req["targetDaysToOffer"]}
              hint={`Between ${MIN_TARGET_DAYS_TO_OFFER} and ${MAX_TARGET_DAYS_TO_OFFER} days.`}
            >
              <Input
                type="text"
                inputMode="numeric"
                value={state.targetDaysToOffer}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
                  set("targetDaysToOffer", digits);
                  setErrors((prev) => ({ ...prev, targetDaysToOffer: "" }));
                }}
                placeholder="21"
                className="max-w-[8rem]"
              />
            </Field>
          </SectionGroup>

          <SectionGroup title="Decision maker">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Who makes the final decision?" carried={isCarried("decisionMaker")}
                error={errors.decisionMaker}
                required={req["decisionMaker"]}
                hint="Name and role. We keep the process moving through them."
              >
                <Input
                  value={state.decisionMaker}
                  onChange={(e) => set("decisionMaker", e.target.value)}
                  placeholder="Dana Okoro, Operations Director"
                />
              </Field>
              <Field
                label="Their email" carried={isCarried("decisionMakerEmail")}
                error={errors.decisionMakerEmail}
                required={req["decisionMakerEmail"]}
                hint="Only used if you invite them below."
              >
                <Input
                  type="email"
                  value={state.decisionMakerEmail}
                  onChange={(e) => {
                    set("decisionMakerEmail", e.target.value);
                    setErrors((prev) => ({ ...prev, decisionMakerEmail: "" }));
                  }}
                  placeholder="dana@company.com"
                />
              </Field>
            </div>
          </SectionGroup>

          {collaborators.length > 0 && (
            <SectionGroup title="People you named">
              <div className="rounded-lg border border-[color:var(--brand-navy)]/15 bg-white p-4">
                <ul className="space-y-0.5 text-sm text-[color:var(--brand-navy)]/75">
                  {collaborators.map((c) => (
                    <li key={c.email}>{c.name ? `${c.name} — ${c.email}` : c.email}</li>
                  ))}
                </ul>
                <div className="mt-3 flex items-start gap-3">
                  <Checkbox
                    id="invite-collaborators"
                    checked={state.inviteCollaborators}
                    onCheckedChange={(v) => set("inviteCollaborators", v === true)}
                    className="mt-0.5"
                  />
                  <span className="order-last text-xs text-[color:var(--brand-navy)]/60">
                    Optional
                  </span>
                  <label htmlFor="invite-collaborators" className="text-sm leading-relaxed">
                    {COLLABORATOR_OPT_IN_LABEL}
                  </label>
                </div>
                {!state.inviteCollaborators && (
                  <p className="mt-2 text-xs text-[color:var(--brand-navy)]/60">
                    We will not email anyone on this list.
                  </p>
                )}
              </div>
            </SectionGroup>
          )}

        </Section>
        )}



        {step === 3 && (
          <>
        <Card className="border-[color:var(--brand-navy)]/12">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Review your role brief</h2>
            </div>
            <p className="text-sm text-[color:var(--brand-navy)]/70">
              This is the last chance to correct anything before you submit.
            </p>

            {duplicateError && (
              <div
                role="alert"
                className="rounded-lg border border-[color:var(--brand-danger)]/30 bg-[color:var(--brand-danger)]/5 p-4 text-sm leading-relaxed"
              >
                {duplicateError}
              </div>
            )}

            {duplicate && (
              <div
                className="space-y-3 rounded-xl border border-[color:var(--brand-navy)]/12 bg-[color:var(--brand-navy)]/4 p-4"
                data-testid="duplicate-notice"
              >
                <p className="text-sm font-semibold">
                  Started from{" "}
                  {duplicate.sourceTitle ? `your “${duplicate.sourceTitle}” brief` : "an earlier role"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60">
                      Copied
                    </p>
                    <ul className="mt-1 space-y-1 text-sm text-[color:var(--brand-navy)]/75">
                      {duplicate.copied.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--brand-navy)]/60">
                      Not copied
                    </p>
                    <ul className="mt-1 space-y-1 text-sm text-[color:var(--brand-navy)]/75">
                      {duplicate.notCopied.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {dupTitleUnchanged && (
                  <div className="rounded-lg border border-[color:var(--brand-navy)]/12 bg-white/60 p-3">
                    <p className="text-sm">
                      This role still has the same title as the one you copied.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => editFromReview({ step: 1, focusLabel: "Job title" })}
                      >
                        Change the title
                      </Button>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={dupTitleConfirmed}
                          onChange={(e) => setDupTitleConfirmed(e.target.checked)}
                          data-testid="duplicate-title-confirm"
                        />
                        The title is intentionally the same
                      </label>
                    </div>
                  </div>
                )}

                {duplicate.compensationStale && (
                  <div className="rounded-lg border border-[color:var(--brand-navy)]/12 bg-white/60 p-3">
                    <p className="text-sm">
                      The compensation came from a brief more than {COMPENSATION_STALE_DAYS} days old
                      {duplicate.compensationAsOf
                        ? ` (last set ${formatDate(duplicate.compensationAsOf)})`
                        : ""}
                      . Worth a look before it goes out to candidates.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => editFromReview({ step: 2, focusLabel: "From" })}
                      >
                        Review compensation
                      </Button>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={dupCompReviewed}
                          onChange={(e) => setDupCompReviewed(e.target.checked)}
                          data-testid="duplicate-comp-confirm"
                        />
                        I have checked the range is still right
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
            <IntakeReviewPanel
              review={review}
              loading={draftPhase === "restoring"}
              onEdit={editFromReview}
            />
            {!brief.complete && (
              <div className="rounded-lg border border-[color:var(--brand-amber)]/30 bg-[color:var(--brand-navy)]/4 p-4">
                <p className="text-sm font-semibold">
                  This brief is incomplete — you can still submit it.
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                  The role will be labelled <span className="font-medium">Brief incomplete</span> in
                  your workspace until you add: {brief.missing.join(", ").toLowerCase()}. You can
                  finish it any time from the role page.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-[color:var(--brand-navy)]/12">
          <CardContent className="space-y-4 pt-6">
            <div className="rounded-lg bg-[color:var(--brand-navy)]/4 p-4">
              <p className="text-sm font-semibold">What happens after you submit</p>
              <ol className="mt-2 space-y-1 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                <li>1. Your account and workspace are created — free.</li>
                <li>2. We review the role and confirm we can deliver it.</li>
                {PAYMENTS_ENABLED ? (
                  <li>
                    3. Only then do you pay the ${PRICE_PILOT_USD} one-time pilot fee. The pilot window starts
                    when the search goes live.
                  </li>
                ) : (
                  <li>
                    3. You pick a time on the next screen. We agree the plan on the call, then the search goes live.
                  </li>
                )}
              </ol>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--brand-navy)]/75">
                {PAYMENTS_ENABLED ? (
                  <>
                    One active role, any industry, anywhere in the world, no placement fees.{" "}
                    {PILOT_ONE_PER_COMPANY} First candidate activity usually begins within 3–5 days after
                    go-live.
                  </>
                ) : (
                  <>
                    One active role, any industry, anywhere in the world. Your workspace opens immediately.
                    First candidate activity usually begins within 3–5 days after we agree the plan on the call.
                  </>
                )}
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="pilot-acknowledgement"
                checked={state.pilotAcknowledgement}
                onCheckedChange={(v) => set("pilotAcknowledgement", v === true)}
                className="mt-0.5"
                aria-invalid={Boolean(errors.pilotAcknowledgement)}
                aria-describedby={errors.pilotAcknowledgement ? "intake-pilotAcknowledgement-error" : undefined}
              />
              <span aria-hidden="true" className="order-last text-sm text-[color:var(--brand-navy)]/70">
                *
              </span>
              <label htmlFor="pilot-acknowledgement" className="text-sm leading-relaxed">
                {PAYMENTS_ENABLED ? (
                  <>
                    I understand there is no charge today, and that the ${PRICE_PILOT_USD} one-time
                    pilot is billed only after my account is created and the role is accepted. The pilot
                    can be used once per company, for one position — a second sign-up or a new email does
                    not create a new pilot. Separate locations, franchises and subsidiaries are reviewed
                    case by case.
                  </>
                ) : (
                  <>
                    I understand this is free to start today, that my workspace opens immediately, and that we
                    agree the plan on the call before the search goes live. This initial role can be started
                    once per company — a second sign-up or a new email does not create a new start. Separate
                    locations, franchises and subsidiaries are reviewed case by case.
                  </>
                )}
              </label>

            </div>

            {errors.pilotAcknowledgement && (
              <p id="intake-pilotAcknowledgement-error" data-field-error="true" className="text-sm text-[color:var(--brand-danger)]">
                {errors.pilotAcknowledgement}
              </p>
            )}

            <div className="flex items-start gap-3">
              <Checkbox
                id="research-consent"
                checked={state.researchConsent}
                onCheckedChange={(v) => set("researchConsent", v === true)}
                className="mt-0.5"
              />
              <span className="order-last text-xs text-[color:var(--brand-navy)]/60">Optional</span>
              <label htmlFor="research-consent" className="text-sm leading-relaxed">
                Review my company's public website to fill in company context. You can turn this off —
                we'll use only the job description.
              </label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms-consent"
                checked={state.consent}
                onCheckedChange={(v) => set("consent", v === true)}
                className="mt-0.5"
                aria-invalid={Boolean(errors.consent)}
                aria-describedby={errors.consent ? "intake-consent-error" : undefined}
              />
              <span aria-hidden="true" className="order-last text-sm text-[color:var(--brand-navy)]/70">
                *
              </span>
              <label htmlFor="terms-consent" className="text-sm leading-relaxed">
                I accept the{" "}
                <a href="/terms" className="underline">
                  terms
                </a>{" "}
                and{" "}
                <a href="/privacy" className="underline">
                  privacy policy
                </a>
                .
              </label>
            </div>
            {errors.consent && (
              <p id="intake-consent-error" data-field-error="true" className="text-sm text-[color:var(--brand-danger)]">
                {errors.consent}
              </p>
            )}

            {/* Spam trap — intentionally hidden from people and assistive tech. */}
            <div aria-hidden className="hidden">
              <label htmlFor="company-fax">Company fax</label>
              <input
                id="company-fax"
                tabIndex={-1}
                autoComplete="off"
                value={state.companyFax}
                onChange={(e) => set("companyFax", e.target.value)}
              />
            </div>

            {submitError && (
              <div
                role="alert"
                className="space-y-3 rounded-lg border border-[color:var(--brand-danger)]/30 bg-[color:var(--brand-danger)]/5 p-4"
              >
                <p className="text-sm leading-relaxed">{submitError}</p>
                <p className="text-xs text-[color:var(--brand-navy)]/70">
                  Nothing you typed was lost.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void submit(lastIntentRef.current)}
                  disabled={submitting}
                >
                  Retry
                </Button>
              </div>
            )}

            <div className="rounded-xl border border-[color:var(--brand-navy)]/12 p-4">
              <p className="text-sm font-semibold">
                {PAYMENTS_ENABLED ? "Choose how you'd like to start" : "Create your workspace and pick a time"}
              </p>
              <p className="mt-1 text-sm text-[color:var(--brand-navy)]/70">
                {PAYMENTS_ENABLED
                  ? "Both create your workspace and analyse the role. One publishes today; the other keeps it saved until we've spoken."
                  : "Your workspace opens immediately. We agree the plan on the call and activate the search once you're ready."}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {PAYMENTS_ENABLED ? (
                  <>
                    <Button
                      type="button"
                      data-testid="intake-submit-pay"
                      onClick={() => void submit("pay")}
                      disabled={submitting || review.missing.length > 0 || submitBlockers.length > 0 || dupBlockers.length > 0}
                      className="min-h-12 w-full"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          Creating your workspace…
                        </>
                      ) : (
                        "Start now — pay and publish"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="intake-submit-call"
                      onClick={() => void submit("call")}
                      disabled={submitting || review.missing.length > 0 || submitBlockers.length > 0 || dupBlockers.length > 0}
                      className="min-h-12 w-full"
                    >
                      Book a call first
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    data-testid="intake-submit-call"
                    onClick={() => void submit("call")}
                    disabled={submitting || review.missing.length > 0 || submitBlockers.length > 0 || dupBlockers.length > 0}
                    className="min-h-12 w-full"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Creating your workspace…
                      </>
                    ) : (
                      "Create my workspace and pick a time"
                    )}
                  </Button>
                )}
              </div>
              {review.missing.length > 0 && (
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/75" role="status">
                  Submit unlocks once the required answers named in the review above are filled in.
                </p>
              )}
              {/*
                Blockers that are not missing answers — two fields that
                contradict each other, a value the brief cannot accept. The
                review's "still missing" list can only describe emptiness, so
                these were invisible: the summary read as cleared, the button
                looked enabled, and clicking it did nothing (INT-001). They are
                named here, in full, next to the button they are holding.
              */}
              {submitBlockers.length > 0 && (
                <div
                  role="status"
                  className="mt-3 rounded-lg border border-[color:var(--brand-danger)]/35 bg-[color:var(--brand-danger)]/6 p-3 text-sm"
                >
                  <p className="font-semibold text-[color:var(--brand-danger)]">
                    {submitBlockers.length === 1
                      ? "One answer still needs fixing before you can submit:"
                      : `${submitBlockers.length} answers still need fixing before you can submit:`}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[color:var(--brand-navy)]/85">
                    {submitBlockers.map((b) => (
                      <li key={b.field}>{b.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              {dupBlockers.length > 0 && (
                <p className="mt-3 text-sm text-[color:var(--brand-navy)]/75" role="status">
                  Before you submit this duplicate: {dupBlockers.join(" \u00b7 ")}.
                </p>
              )}
              <p className="mt-3 text-sm text-[color:var(--brand-navy)]/70">
                {PAYMENTS_ENABLED
                  ? "Booking a call still opens your workspace straight away. The role stays saved with payment pending until we agree the plan."
                  : "The role is saved in your workspace straight away. We confirm the plan on the call before anything goes live."}
              </p>
              <p className="mt-3 text-sm text-[color:var(--brand-navy)]/70">
                Your information stays inside TaaSFlow, part of Flow Group Ventures, and is never sold or passed to third parties.
              </p>
            </div>
            <ul className="grid gap-2 pt-1 text-sm text-[color:var(--brand-navy)]/70 sm:grid-cols-3">
              {["Role live in your workspace", "Blueprint built for you", "Every answer editable"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--brand-teal)]" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
          </>
        )}

        {(() => {

          const blocking = STEP_FIELDS[currentStep.key]
            .map((f) => errors[f])
            .filter((m): m is string => Boolean(m));
          if (blocking.length === 0) return null;
          return (
            <div
              role="alert"
              className="rounded-lg border border-[color:var(--brand-danger)]/35 bg-[color:var(--brand-danger)]/6 p-4 text-sm"
            >
              <p className="font-semibold text-[color:var(--brand-danger)]">
                {blocking.length === 1
                  ? "One thing still needs your answer:"
                  : `${blocking.length} things still need your answer:`}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[color:var(--brand-navy)]/85">
                {blocking.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          );
        })()}

        {/* Step navigation. Back never validates; Continue does. */}
        <div
          data-testid="intake-nav"
          data-step={String(stepIndex)}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--brand-navy)]/12 pt-5"
        >

          <Button
            type="button"
            data-testid="step-back"
            variant="ghost"
            onClick={goBack}
            disabled={stepIndex === 0 || submitting}
            className="min-h-11"
          >
            Back
          </Button>
          <div className="flex items-center gap-3">
            {!currentStep.required && stepIndex < INTAKE_STEPS.length - 1 && (
              <button
                type="button"
                data-testid="step-skip"
                className="text-sm underline text-[color:var(--brand-navy)]/70 disabled:opacity-50"
                onClick={() => goNext(true)}
                disabled={draftPhase === "restoring" || submitting}
              >
                Finish this later
              </button>
            )}
            {stepIndex < INTAKE_STEPS.length - 1 && (
              <Button
                type="button"
                data-testid="step-continue"
                onClick={() => goNext()}
                // While the saved draft is still being restored the form state is
                // not yet the client's own answers, so a click here would either
                // validate empty values or have its errors wiped by the restore.
                disabled={draftPhase === "restoring" || submitting}
                className="min-h-11"
              >
                {returnToReview ? "Back to review" : "Continue"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </FormShell>
  );
}


function Section({
  title,
  step,
  id,
  children,
}: {
  title: string;
  step: number;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-6 rounded-xl border border-[color:var(--brand-navy)]/12 bg-white p-6 sm:p-8">
      <div className="flex items-center gap-3 border-b border-[color:var(--brand-navy)]/10 pb-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--brand-navy)] text-sm font-bold text-white">
          {step}
        </span>
        <h2 className="text-lg font-bold text-[color:var(--brand-navy)]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SectionGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-[color:var(--brand-navy)]">{title}</h3>
      {children}
    </div>
  );
}

function Field({

  label,
  children,
  error,
  hint,
  required,
  htmlFor,
  carried,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
  /** True when the value arrived from the company profile and is worth checking. */
  carried?: boolean;
  /** Set when the control is nested inside wrapper markup and carries its own id. */
  htmlFor?: string;
}) {
  // Every field gets a generated id so the visible label is programmatically
  // tied to its control — screen readers announce the field name, and clicking
  // the label focuses the input.
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const described = [hint && !error ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");
  const labelFor = htmlFor ?? fieldId;
  const control = !htmlFor && React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: ((children as React.ReactElement<Record<string, unknown>>).props["id"] as
          | string
          | undefined) ?? fieldId,
        "aria-describedby": described || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-required": required === true || undefined,
      })
    : children;
  return (
    <div className="space-y-1.5" data-field={label}>
      {/* The required marker sits outside the <label> so the label's text is
          exactly the field name — that keeps the announced/programmatic name
          clean, while aria-required carries the "required" semantics. */}
      <div className="flex items-baseline">
        <Label htmlFor={labelFor} className="text-sm font-medium">
          {label}
        </Label>
        {required === true && (
          <span className="ml-1 text-sm text-[color:var(--brand-navy)]/70" aria-hidden="true">
            *
          </span>
        )}
        {required === false && (
          <span className="ml-2 text-xs font-normal text-[color:var(--brand-navy)]/60">
            Optional
          </span>
        )}
      </div>
      {control}
      {carried && !error && (
        <p className="text-xs text-[color:var(--brand-navy)]/70">{CARRY_NOTICE}</p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-xs text-[color:var(--brand-navy)]/75">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          data-field-error="true"
          role="alert"
          className="text-sm text-[color:var(--brand-danger)]"
        >
          {error}
        </p>
      )}
    </div>
  );

}


