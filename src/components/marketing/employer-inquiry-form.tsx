/**
 * EmployerInquiryForm — the short employer inquiry (first name, work email,
 * phone, link to the job description). Every field is required. One primary
 * action, no account. Success is shown only after the server has stored the
 * request.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { submitEmployerInquiry } from "@/lib/inquiry.functions";
import {
  INQUIRY_LIMITS,
  INQUIRY_MESSAGES,
  inquiryErrorCategory,
  validateInquiryFields,
  type InquiryErrors,
  type InquiryFields,
} from "@/lib/marketing/employer-inquiry";
import { trackConfirmedConversion } from "@/lib/tracking/fgv-events";
import {
  EMPLOYER_INQUIRY_FORM_TYPE,
  trackLeadFormError,
  trackLeadFormStart,
  trackLeadFormView,
} from "@/lib/tracking/lead-form-events";
import { CTA_PRIMARY } from "@/config/cta";
import { SALES_EMAIL } from "@/config/booking";
import { cn } from "@/lib/utils";

export const INQUIRY_HELPER =
  "No account needed. Share the link to the job description and we will contact you to confirm fit and next steps." as const;

export const INQUIRY_DEFAULT_HEADING = "What role do you need to fill?" as const;

type Props = {
  source: string;
  heading?: string;
  className?: string;
  idPrefix?: string;
};

const EMPTY: InquiryFields = { firstName: "", email: "", phone: "", jobDescriptionUrl: "" };

const inputClass =
  "mt-1 block min-h-11 w-full rounded-md border border-[color:var(--brand-navy)]/25 bg-white px-3 py-2 text-base text-[color:var(--brand-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-ocean)] aria-[invalid=true]:border-red-700";

export function EmployerInquiryForm({ source, heading, className, idPrefix }: Props) {
  const autoId = useId().replace(/:/g, "");
  const prefix = idPrefix ?? `inquiry-${autoId}`;
  const submit = useServerFn(submitEmployerInquiry);

  const [values, setValues] = useState<InquiryFields>(EMPTY);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<InquiryErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  // One key per form mount: a retry or double click cannot create a second lead.
  const keyRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    keyRef.current = crypto.randomUUID();
    trackLeadFormView(source);
  }, [source]);

  const headingId = `${prefix}-heading`;
  const summaryId = `${prefix}-errors`;
  const errorKeys = Object.keys(errors) as (keyof InquiryFields)[];

  function onChange(name: keyof InquiryFields, value: string) {
    if (!startedRef.current) {
      startedRef.current = true;
      trackLeadFormStart(source);
    }
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setServerError(null);
    const found = validateInquiryFields(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      trackLeadFormError(source, inquiryErrorCategory(found));
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    if (!keyRef.current) keyRef.current = crypto.randomUUID();
    setPending(true);
    try {
      const result = await submit({
        data: {
          firstName: values.firstName,
          email: values.email,
          phone: values.phone,
          jobDescriptionUrl: values.jobDescriptionUrl,
          source,
          idempotencyKey: keyRef.current,
          website,
        },
      });
      if (!result.ok) {
        trackLeadFormError(source, "server_rejected");
        setErrors(
          result.error === "invalid_url"
            ? { jobDescriptionUrl: INQUIRY_MESSAGES.jobDescriptionUrl }
            : { phone: INQUIRY_MESSAGES.phone },
        );
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }
      setDone(true);
      if (result.id) {
        try {
          trackConfirmedConversion({
            formType: EMPLOYER_INQUIRY_FORM_TYPE,
            serviceInterest: "recruiting_pilot",
            destinationBrand: "taasflow",
            submissionId: result.id,
          });
        } catch {
          /* analytics must never block the confirmation */
        }
      }
    } catch (err) {
      const limited = err instanceof Error && /too many attempts/i.test(err.message);
      trackLeadFormError(source, limited ? "rate_limited" : "network_error");
      setServerError(
        limited
          ? "Too many attempts from this connection. Wait a minute and try again."
          : `We could not send your request. Your details are still here, so you can try again, or email ${SALES_EMAIL}.`,
      );
      requestAnimationFrame(() => summaryRef.current?.focus());
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <section
        aria-labelledby={headingId}
        className={cn(
          "rounded-2xl border border-[color:var(--brand-navy)]/15 bg-white p-6 sm:p-8",
          className,
        )}
      >
        <h2
          id={headingId}
          tabIndex={-1}
          className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]"
        >
          Your request has been received
        </h2>
        <p role="status" className="mt-2 text-sm text-[color:var(--brand-navy)]/80">
          We will contact you within one business day to confirm the role and the pilot scope.
          Nothing has been charged and no sourcing has started.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <a
            href={`mailto:${SALES_EMAIL}`}
            className="text-sm font-semibold text-[color:var(--brand-ocean-text)] underline-offset-4 hover:underline"
          >
            Prefer email? {SALES_EMAIL}
          </a>
        </div>
      </section>
    );
  }

  const field = (
    name: keyof InquiryFields,
    label: string,
    attrs: React.InputHTMLAttributes<HTMLInputElement>,
    required: boolean,
  ) => {
    const id = `${prefix}-${name}`;
    const err = errors[name];
    return (
      <div>
        <label htmlFor={id} className="text-sm font-semibold text-[color:var(--brand-navy)]">
          {label}
          {required ? null : <span className="font-normal text-[color:var(--brand-navy)]/70"> (optional)</span>}
        </label>
        <input
          id={id}
          name={name}
          value={values[name]}
          onChange={(e) => onChange(name, e.target.value)}
          required={required}
          aria-required={required}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `${id}-error` : undefined}
          className={inputClass}
          {...attrs}
        />
        {err ? (
          <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
            {err}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "rounded-2xl border border-[color:var(--brand-navy)]/15 bg-white p-6 sm:p-8",
        className,
      )}
    >
      <h2
        id={headingId}
        className="font-[family-name:var(--brand-font-display)] text-2xl font-semibold text-[color:var(--brand-navy)]"
      >
        {heading ?? INQUIRY_DEFAULT_HEADING}
      </h2>
      <form noValidate onSubmit={onSubmit} className="mt-5 space-y-4" data-testid="employer-inquiry-form">
        <div
          id={summaryId}
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className={cn(
            errorKeys.length === 0 && !serverError
              ? "sr-only"
              : "rounded-md border border-red-700/40 bg-red-50 p-3 text-sm text-red-800",
          )}
        >
          {serverError ? (
            <p>{serverError}</p>
          ) : errorKeys.length > 0 ? (
            <>
              <p className="font-semibold">Please fix the following before sending:</p>
              <ul className="mt-1 list-disc pl-5">
                {errorKeys.map((k) => (
                  <li key={k}>
                    <a href={`#${prefix}-${k}`} className="underline">
                      {errors[k]}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {field("firstName", "First name", {
            type: "text",
            autoComplete: "given-name",
            maxLength: INQUIRY_LIMITS.firstName,
          }, true)}
          {field("email", "Work email", {
            type: "email",
            autoComplete: "email",
            inputMode: "email",
            maxLength: INQUIRY_LIMITS.email,
          }, true)}
          {field("phone", "Phone", {
            type: "tel",
            autoComplete: "tel",
            inputMode: "tel",
            maxLength: INQUIRY_LIMITS.phone,
          }, true)}
          {field("jobDescriptionUrl", "Job description link", {
            type: "url",
            autoComplete: "url",
            inputMode: "url",
            maxLength: INQUIRY_LIMITS.jobDescriptionUrl,
            placeholder: "https://company.com/careers/role",
          }, true)}
        </div>

        {/* Honeypot: hidden from people and assistive technology. */}
        <div style={{ display: "none" }} aria-hidden="true">
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 sm:w-auto"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {pending ? "Sending your request" : CTA_PRIMARY.label}
        </button>
        <p className="text-sm text-[color:var(--brand-navy)]/80">{INQUIRY_HELPER}</p>
      </form>
    </section>
  );
}
