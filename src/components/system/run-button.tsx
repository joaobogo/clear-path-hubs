import { Link } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Button (The Run). One primary per view. It reads its colours from the
 * surface it sits on (`.day`, `.tint`, `.blue` in tokens.css): blue with
 * white text on white, white with blue text on the blue band.
 *
 * Sizes: lg 64, md 52 (website default), sm 40 (workspace).
 */
export type RunButtonVariant = "primary" | "ghost";
export type RunButtonSize = "lg" | "md" | "sm";

export function runButtonClass(variant: RunButtonVariant = "primary", size: RunButtonSize = "md") {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--r-1)] font-semibold",
    "transition-colors duration-[var(--t-instant)] ease-[var(--ease)]",
    "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[color:var(--blue-600)]",
    "disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40",
    size === "lg" && "min-h-16 px-7 text-[17px]",
    size === "md" && "min-h-[52px] px-6 text-base",
    size === "sm" && "min-h-11 px-4 text-sm md:min-h-10",
    variant === "primary" &&
      "bg-[color:var(--btn-bg,var(--blue-600))] text-[color:var(--btn-fg,#fff)] hover:bg-[color:var(--btn-bg-hover,var(--blue-700))]",
    variant === "ghost" &&
      "border border-[color:var(--line-2,var(--rule-2))] bg-transparent text-[color:var(--text,var(--ink))] hover:bg-[color:var(--wash,var(--blue-50))]",
  );
}

type Common = {
  variant?: RunButtonVariant;
  size?: RunButtonSize;
  className?: string;
  children: ReactNode;
};

export function RunLinkButton({
  to,
  variant,
  size,
  className,
  children,
  ...rest
}: Common & { to: string } & Omit<ComponentProps<typeof Link>, "to" | "className" | "children">) {
  return (
    <Link to={to} className={cn(runButtonClass(variant, size), className)} {...rest}>
      {children}
    </Link>
  );
}

export function RunButton({
  variant,
  size,
  className,
  children,
  type = "button",
  ...rest
}: Common & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button type={type} className={cn(runButtonClass(variant, size), className)} {...rest}>
      {children}
    </button>
  );
}
