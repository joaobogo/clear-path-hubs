import type { ReactNode } from "react";
import { formatUsdExact } from "@/config/pricing-core";
import { cn } from "@/lib/utils";

/**
 * Receipt (The Run): the price as an invoice on white paper, torn top and
 * bottom, dotted leaders, tabular figures. The charges you never make are
 * printed at $0.00 in blue. The only element on the site allowed a shadow
 * and a tilt, because it is paper.
 */
export type ReceiptLine = { label: string; amount: number; note?: string };

/** The sawtooth edge, as a clip path, so the paper reads as torn. */
function torn(teeth: number, depth: number): string {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= teeth; i++) {
    const x = (i / teeth) * 100;
    top.push(`${x.toFixed(2)}% ${i % 2 ? depth : 0}px`);
    bottom.push(`${(100 - x).toFixed(2)}% calc(100% - ${i % 2 ? depth : 0}px)`);
  }
  return `polygon(${[...top, ...bottom].join(", ")})`;
}

const money = (n: number) =>
  n === 0 ? "$0.00" : `${formatUsdExact(n)}.00`;

export function Receipt({
  title,
  subtitle,
  lines,
  total,
  footer,
  tilt = 0,
  className,
}: {
  title: string;
  subtitle?: string;
  lines: readonly ReceiptLine[];
  total: { label: string; amount: number };
  footer?: ReactNode;
  /** Degrees. Paper may lie a little askew; nothing else on the site may. */
  tilt?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("paper w-full max-w-[420px] bg-white", className)}
      style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined, clipPath: torn(28, 7) }}
    >
      <div className="px-7 pb-8 pt-9">
        <p className="wide text-xl font-semibold text-[color:var(--ink)]">{title}</p>
        {subtitle ? <p className="mt-1 text-sm text-[color:var(--slate)]">{subtitle}</p> : null}
        <dl className="mt-5 flex flex-col gap-2.5">
          {lines.map((l, i) => (
            <div key={`${l.label}-${i}`} className="text-[15px]">
              <div className="flex items-baseline gap-2">
                <dt className="min-w-0 text-[color:var(--ink)]">{l.label}</dt>
                <span aria-hidden className="mb-1 min-w-4 flex-1 self-end border-b border-dotted border-[color:var(--rule-2)]" />
                <dd className={cn("num shrink-0 font-medium", l.amount === 0 ? "text-[color:var(--blue-600)]" : "text-[color:var(--ink)]")}>
                  {money(l.amount)}
                </dd>
              </div>
              {l.note ? <p className="text-[13px] text-[color:var(--faint)]">{l.note}</p> : null}
            </div>
          ))}
        </dl>
        <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-[color:var(--ink)] pt-3">
          <span className="text-base font-semibold text-[color:var(--ink)]">{total.label}</span>
          <span className="wide num shrink-0 text-[26px] font-semibold leading-none text-[color:var(--ink)]">{money(total.amount)}</span>
        </div>
        {footer ? <div className="mt-4 text-sm text-[color:var(--slate)]">{footer}</div> : null}
      </div>
    </div>
  );
}
