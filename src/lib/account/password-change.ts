import { collectErrors, FORM_MESSAGES } from "@/lib/form-validation";

/** Same minimum as account creation and the reset page. */
export const MIN_PASSWORD_LENGTH = 8;

export type PasswordChangeFields = { current: string; next: string; confirm: string };

/**
 * Validation for the in-place password change. Pure, so it is unit-tested.
 * Returns field → message for every problem, or {} when the form can submit.
 */
export function passwordChangeErrors(
  f: PasswordChangeFields,
): Partial<Record<keyof PasswordChangeFields, string>> {
  return collectErrors<keyof PasswordChangeFields>({
    current: f.current ? null : "Enter your current password.",
    next:
      f.next.length < MIN_PASSWORD_LENGTH
        ? FORM_MESSAGES.passwordMin
        : f.next === f.current
          ? "Choose a password different from your current one."
          : null,
    confirm: f.next === f.confirm ? null : FORM_MESSAGES.passwordMismatch,
  });
}
