import { useMemo } from "react";
import { formatEnumLabel } from "@/lib/human-labels";

type Props = {
  name: string;
  displayName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  parentName: string | null;
  role: string;
  supportView?: boolean;
};

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "•";
}

/**
 * Client-branded workspace header.
 *
 * Shows the client's logo lockup + optional business-unit breadcrumb, while
 * anchoring the TaaSFlow product shell with a "Delivered by TaaSFlow" ribbon.
 */
export function ClientBrandHeader({
  name,
  displayName,
  logoUrl,
  primaryColor,
  accentColor,
  parentName,
  role,
  supportView,
}: Props) {
  const label = displayName?.trim() || name;
  const initials = useMemo(() => initialsOf(label), [label]);

  const primary = primaryColor || "hsl(var(--primary))";
  const accent = accentColor || "hsl(var(--accent))";
  const gradient = `linear-gradient(120deg, ${primary} 0%, ${accent} 100%)`;
  const softTint = primaryColor
    ? `color-mix(in oklab, ${primaryColor} 8%, transparent)`
    : "hsl(var(--muted) / 0.4)";

  return (
    <section
      className="relative overflow-hidden rounded-2xl border bg-card shadow-sm"
      aria-label={`${label} workspace header`}
    >
      {/* Brand accent stripe */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: gradient }}
      />
      {/* Soft tint wash */}
      <div
        aria-hidden
        className="absolute inset-0 -z-0"
        style={{ background: softTint }}
      />
      <div className="relative flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
        {/* Logo lockup */}
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background"
          style={
            primaryColor
              ? { borderColor: `color-mix(in oklab, ${primaryColor} 40%, transparent)` }
              : undefined
          }
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${label} logo`}
              className="h-full w-full object-contain p-1"
              loading="lazy"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span
              className="text-lg font-semibold"
              style={{ color: primaryColor ?? undefined }}
            >
              {initials}
            </span>
          )}
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          {parentName && parentName !== label ? (
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              <span>{parentName}</span>
              <span aria-hidden> · </span>
              <span className="text-foreground/70">Business unit</span>
            </div>
          ) : (
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Workspace
            </div>
          )}
          <h1 className="mt-0.5 truncate text-lg font-semibold text-foreground sm:text-xl">
            {label}
          </h1>
          <div className="mt-0.5 text-xs text-muted-foreground">
            <span>{formatEnumLabel(role)}</span>
            {supportView ? (
              <>
                <span aria-hidden> · </span>
                <span className="text-warning-strong">support view</span>
              </>
            ) : null}
          </div>
        </div>

        {/* TaaSFlow product-shell ribbon */}
        <div className="ml-auto hidden shrink-0 flex-col items-end sm:flex">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Delivered on
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            TaaSFlow
          </span>
        </div>
      </div>
    </section>
  );
}
