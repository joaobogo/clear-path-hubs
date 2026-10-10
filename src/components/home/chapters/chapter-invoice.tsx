import { useState } from "react";
import { Chapter } from "@/components/home/chapters/chapter";
import { Receipt, type ReceiptLine } from "@/components/signature/receipt";
import { RunLinkButton } from "@/components/system/run-button";
import { WeightSlider } from "@/components/system/weight-slider";
import { offer } from "@/config/offer";
import { CALCULATOR_DEFAULTS } from "@/config/public-pricing";
import { formatUsdExact, packageForPositions } from "@/config/pricing-core";
import { RUN_CHAPTERS } from "@/config/run-chapters";

const chapter = RUN_CHAPTERS[4]!;
const DEFAULT_ROLES = 5;
const DEFAULT_SALARY = CALCULATOR_DEFAULTS.averageSalaryUsd;
const pct = Math.round(offer.agencyFee * 100);

/**
 * Chapter 5, Invoice (Day 30, paper). The price argument once, physically:
 * the agency's invoice with one line per hire beside TaaSFlow's with one
 * line and three $0.00 lines. Agency = roles × salary × agency fee.
 * TaaSFlow = the published package for that many roles.
 */
export function ChapterInvoice({ lastUpdated }: { lastUpdated: string }) {
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [salary, setSalary] = useState<number>(DEFAULT_SALARY);

  const feePerHire = Math.round(salary * offer.agencyFee);
  const agencyLines: ReceiptLine[] = Array.from({ length: roles }, (_, i) => ({
    label: `Placement fee, hire ${i + 1}`,
    note: `${pct}% of ${formatUsdExact(salary)}`,
    amount: feePerHire,
  }));
  const agencyTotal = feePerHire * roles;

  const pkg = packageForPositions(roles);
  const ourLines: ReceiptLine[] = [
    { label: pkg ? `Package, ${pkg.capacityLabel.toLowerCase()}` : "Package", amount: pkg?.totalUsd ?? 0 },
    { label: "Placement fee", amount: 0 },
    { label: "Percentage of salary", amount: 0 },
    { label: `Access for ${offer.accessMonths} months`, amount: 0 },
  ];
  const ourTotal = pkg?.totalUsd ?? 0;
  const kept = agencyTotal - ourTotal;

  return (
    <Chapter
      chapter={chapter}
      index={5}
      title="Then compare the invoices."
      lead={`An agency bills a percentage of every salary. TaaSFlow bills one flat package, however many of the ten you hire. The agency fee here is ${pct}%, stated beside every comparison.`}
    >
      <div className="flex flex-col gap-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          <div className="flex flex-col gap-8">
          <WeightSlider
            label="Roles you fill this year"
            value={roles}
            min={1}
            max={offer.maxRoles}
            onChange={setRoles}
            format={(v) => `${v}`}
            valueText={`${roles} roles`}
          />
          <WeightSlider
            label="Average salary"
            value={salary}
            min={20_000}
            max={300_000}
            step={5_000}
            onChange={setSalary}
            format={formatUsdExact}
            hint="An example value, not an industry figure."
          />
          </div>
          <div className="border-t border-[color:var(--ink)] pt-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <p className="text-[15px] text-[color:var(--slate)]">What you keep</p>
            <p className="wide num mt-1 whitespace-nowrap text-[clamp(44px,5vw,64px)] font-semibold leading-none text-[color:var(--blue-600)]" aria-live="polite">
              {formatUsdExact(Math.max(0, kept))}
            </p>
            <p className="mt-3 max-w-[480px] text-[15px] text-[color:var(--slate)]">
              {roles} {roles === 1 ? "hire" : "hires"} × {formatUsdExact(salary)} × {pct}% = {formatUsdExact(agencyTotal)} at an agency.
              {pkg ? ` The ${pkg.capacityLabel.toLowerCase()} package is ${pkg.totalDisplay}, once.` : ""} Your own figures replace these the moment you move a slider.
            </p>
            <RunLinkButton to="/pricing" variant="ghost" className="mt-6">
              See every package
            </RunLinkButton>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 sm:items-start sm:justify-items-start">
          <Receipt title="An agency" subtitle={`${roles} ${roles === 1 ? "hire" : "hires"}, ${pct}% of each salary`} lines={agencyLines} total={{ label: "Total", amount: agencyTotal }} />
          <Receipt
            title="TaaSFlow"
            subtitle={`${roles} ${roles === 1 ? "hire" : "hires"}, one package`}
            lines={ourLines}
            total={{ label: "Total", amount: ourTotal }}
            tilt={-0.6}
            footer={<p>Prices from the published packages. {lastUpdated}.</p>}
          />
        </div>
      </div>
    </Chapter>
  );
}
