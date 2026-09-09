/**
 * Every pixel, every event, every provider — does the wiring actually reach
 * the wire?
 *
 * The tags were installed and the mapping table was correct, but nothing
 * raised the events. `trackFormSubmit` — the helper that produces GA4
 * `generate_lead`, Meta `Lead` and the LinkedIn conversion — had ZERO direct
 * call sites, and the job application flow, the biggest candidate conversion
 * on the site, fired no pixel event at all: it called the SERVER funnel logger
 * (a database row) and stopped there. `application_started`, `cv_selected` and
 * `application_submitted` sat in the conversion map with Meta mappings that
 * nothing ever triggered.
 *
 * Two kinds of assertion here, and both are needed:
 *   - the MAP resolves each event to the right per-provider vocabulary;
 *   - a real call site RAISES each event. A mapping nobody fires measures
 *     nothing, which is the state this file was written to end.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONVERSIONS, CONVERSION_MAP, resolveConversion } from "@/lib/tracking/conversion-map";
import { TRACKER_CATEGORY } from "@/lib/tracking/pixels";

const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Source of every module that may raise a tracking event. */
const CALL_SITES = [
  "src/routes/jobs.$id.apply.tsx",
  "src/routes/intake.tsx",
  "src/routes/contact.tsx",
  "src/lib/tracking/fgv-events.ts",
  "src/lib/tracking/conversions.ts",
  "src/lib/booking/booking-events.ts",
  "src/components/analytics/tracking-route-observer.tsx",
  "src/components/marketing/booking-cta-router.tsx",
].map((f) => strip(src(f)));

/** Events raised through a typed helper rather than by name at the call site. */
const RAISED_VIA_HELPER: Record<string, string> = {
  page_view: "trackPageView(",
};

const raisedSomewhere = (event: string) => {
  const helper = RAISED_VIA_HELPER[event];
  return CALL_SITES.some(
    (s) =>
      s.includes(`"${event}"`) ||
      s.includes(`'${event}'`) ||
      (helper ? s.includes(helper) : false),
  );
};

describe("the conversion map speaks each provider's dialect", () => {
  it("form_submit is a lead everywhere it can be", () => {
    const r = resolveConversion(CONVERSIONS.formSubmit, { form_type: "sales_contact" });
    expect(r.ga4Event, "GA4 optimises on generate_lead").toBe("generate_lead");
    expect(r.meta?.event, "Meta standard event").toBe("Lead");
    expect(r.meta?.params.content_category).toBe("sales_contact");
  });

  it("a signup is a registration, not a lead", () => {
    const r = resolveConversion(CONVERSIONS.dashboardSignup, { method: "email_password" });
    expect(r.ga4Event).toBe("sign_up");
    expect(r.meta?.event).toBe("CompleteRegistration");
  });

  it("a CTA click is a micro-event and never a Meta Lead", () => {
    const r = resolveConversion(CONVERSIONS.ctaClick, { cta: "book_a_call" });
    expect(r.ga4Event).toBe("cta_click");
    expect(r.meta, "a click is not a conversion").toBeNull();
  });

  it("the candidate funnel maps to Meta's standard vocabulary", () => {
    expect(resolveConversion("application_started").meta?.event).toBe("InitiateCheckout");
    expect(resolveConversion("cv_selected").meta?.event).toBe("AddPaymentInfo");
    expect(resolveConversion("application_submitted").meta?.event).toBe("SubmitApplication");
    expect(resolveConversion("view_job").meta?.event).toBe("ViewContent");
  });

  it("an unmapped event still reaches GA4 under its own name", () => {
    const r = resolveConversion("express_intake_submitted", { flow: "express_onboarding" });
    expect(r.ga4Event).toBe("express_intake_submitted");
    expect(r.meta).toBeNull();
  });

  it("LinkedIn gets a numeric conversion id or nothing at all", () => {
    // Sending a NAME to lintrk is a silent no-op that pollutes the tag, so the
    // resolver must return null until the ids are configured.
    const r = resolveConversion(CONVERSIONS.formSubmit);
    if (r.linkedin) expect(String(r.linkedin.conversion_id)).toMatch(/^\d+$/);
    else expect(r.linkedin).toBeNull();
  });
});

describe("every mapped conversion is actually raised by something", () => {
  // The defect this whole file exists for: a correct mapping that no call site
  // ever triggers measures nothing.
  const MUST_BE_RAISED = [
    "application_started",
    "cv_selected",
    "application_submitted",
    "view_job",
    "view_job_board",
    "candidate_signup_started",
    "page_view",
  ];

  for (const event of MUST_BE_RAISED) {
    it(`${event} has a real call site`, () => {
      expect(raisedSomewhere(event), `${event} is mapped but never fired`).toBe(true);
    });
  }

  it("the apply flow reaches the pixels, not only the server funnel", () => {
    const apply = strip(src("src/routes/jobs.$id.apply.tsx"));
    expect(apply, "must import the pixel tracker").toMatch(
      /import \{ trackEvent \} from "@\/lib\/tracking\/pixels"/,
    );
    // `track(...)` is the server-side funnel logger and reaches no pixel;
    // both must be present, and the pixel one is what was missing.
    expect(apply).toMatch(/track\("apply_submitted"/);
    expect(apply).toMatch(/trackEvent\("application_submitted"/);
  });

  it("the confirmed-conversion helper is wired to the canonical lead event", () => {
    const fgv = strip(src("src/lib/tracking/fgv-events.ts"));
    expect(fgv).toMatch(/trackFormSubmit\(/);
    // And something actually calls it — otherwise generate_lead never fires.
    const callers = [
      "src/routes/contact.tsx",
      "src/routes/intake.tsx",
      "src/components/marketing/book-a-call.tsx",
    ].filter((f) => strip(src(f)).includes("trackConfirmedConversion("));
    expect(callers.length, "no surface reports a confirmed conversion").toBeGreaterThan(0);
  });
});

describe("no personal data leaves the browser", () => {
  it("the apply flow sends no name, email or file name with its events", () => {
    const apply = strip(src("src/routes/jobs.$id.apply.tsx"));
    const calls = [...apply.matchAll(/trackEvent\((.{0,220}?)\)\;/gs)].map((m) => m[1]);
    expect(calls.length, "expected the apply flow to raise events").toBeGreaterThan(0);
    for (const call of calls) {
      for (const forbidden of ["form.email", "form.name", "f.name", "cvFile", "password"]) {
        expect(call, `event payload carries ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("the ecosystem event layer allow-lists its parameters", () => {
    const fgv = strip(src("src/lib/tracking/fgv-events.ts"));
    expect(fgv).toMatch(/ALLOWED_PARAMS/);
    expect(fgv, "and drops anything that looks personal").toMatch(/LOOKS_PERSONAL/);
  });
});

describe("each tracker is gated by the category it belongs to", () => {
  it("assigns every tracker a category", () => {
    expect(Object.keys(TRACKER_CATEGORY).sort()).toEqual(
      ["clarity", "ga4", "hotjar", "linkedin", "meta", "rb2b"].sort(),
    );
  });

  it("puts advertising tags in marketing and measurement tags in analytics", () => {
    expect(TRACKER_CATEGORY.meta).toBe("marketing");
    expect(TRACKER_CATEGORY.linkedin).toBe("marketing");
    expect(TRACKER_CATEGORY.rb2b).toBe("marketing");
    expect(TRACKER_CATEGORY.ga4).toBe("analytics");
    expect(TRACKER_CATEGORY.clarity).toBe("analytics");
    expect(TRACKER_CATEGORY.hotjar).toBe("analytics");
  });
});

describe("the map has no entries that can never fire", () => {
  it("lists which mapped events lack a call site", () => {
    // Not a failure — some entries are legitimately reserved — but the list is
    // printed so a dead mapping cannot quietly accumulate again.
    const dead = Object.keys(CONVERSION_MAP).filter(
      (e) => !raisedSomewhere(e) && e !== CONVERSIONS.formSubmit && e !== CONVERSIONS.ctaClick && e !== CONVERSIONS.dashboardSignup,
    );
    // These three are raised through their typed helpers rather than by name.
    expect(dead.sort()).toEqual(["candidate_account_invited", "contact_form_submitted"]);
  });
});
