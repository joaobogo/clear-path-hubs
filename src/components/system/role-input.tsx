import { useNavigate } from "@tanstack/react-router";
import { useId, useState, type FormEvent } from "react";
import { CTA_RUN_ROLE } from "@/config/cta";
import { cleanRole, ROLE_INPUT_MAX } from "@/lib/marketing/role-input";
import { trackEvent } from "@/lib/tracking/pixels";
import { cn } from "@/lib/utils";
import { runButtonClass } from "@/components/system/run-button";

/**
 * RoleInput (The Run): "I'm hiring a …", a typed role, one button.
 * Submits on Enter and carries the role to Intake as ?role=.
 *
 * Sizes: "site" 68 high (hero, hub, industry pages), "closing" 84 (the
 * closing band). It reads the surface it sits on, so on the blue band the
 * field is white with a blue button.
 */
export function RoleInput({
  size = "site",
  defaultRole = "",
  source,
  suggestions,
  onRun,
  className,
}: {
  size?: "site" | "closing";
  defaultRole?: string;
  /** Where the input sits, for analytics (never the typed text). */
  source: string;
  /** Typical roles offered under the field. */
  suggestions?: readonly string[];
  /**
   * The homepage keeps the visitor on the page and redraws every chapter for
   * the role. Everywhere else the input opens Intake with the role filled in.
   */
  onRun?: (role: string) => void;
  className?: string;
}) {
  const id = useId();
  const listId = `${id}-roles`;
  const navigate = useNavigate();
  const [role, setRole] = useState(defaultRole);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = cleanRole(role);
    trackEvent("role_typed", { source, has_role: clean.length > 0 });
    if (onRun) {
      onRun(clean);
      return;
    }
    void navigate({ to: CTA_RUN_ROLE.to, search: clean ? { role: clean } : {} });
  };

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="Run a role"
      className={cn(
        "flex w-full flex-col gap-2 rounded-[var(--r-2)] border border-[color:var(--line-2,var(--rule-2))] bg-white p-2 sm:flex-row sm:items-center",
        "focus-within:border-[color:var(--blue-600)]",
        className,
      )}
    >
      <label
        htmlFor={id}
        className={cn(
          "flex min-w-0 flex-1 items-baseline gap-2 px-3 text-[color:var(--ink)]",
          size === "closing" ? "min-h-[68px] text-xl sm:text-2xl" : "min-h-[52px] text-lg",
        )}
      >
        <span className="shrink-0 self-center text-[color:var(--slate)]">I'm hiring a</span>
        <input
          id={id}
          name="role"
          value={role}
          maxLength={ROLE_INPUT_MAX}
          autoComplete="off"
          spellCheck={false}
          placeholder="Registered nurse"
          list={suggestions ? listId : undefined}
          onChange={(e) => setRole(e.target.value)}
          className="min-w-0 flex-1 self-center bg-transparent font-semibold text-[color:var(--ink)] [font-stretch:110%] placeholder:font-normal placeholder:text-[color:var(--faint)] focus:outline-none"
        />
      </label>
      {suggestions ? (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
      <button
        type="submit"
        className={cn(
          runButtonClass("primary", size === "closing" ? "lg" : "md"),
          // The field is always white, so the button is always blue.
          "bg-[color:var(--blue-600)] text-white hover:bg-[color:var(--blue-700)]",
        )}
      >
        {CTA_RUN_ROLE.label}
      </button>
    </form>
  );
}
