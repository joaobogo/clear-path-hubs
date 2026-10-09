import { clockFraction, RUN_SIGN_OFF_DAY } from "@/config/run-chapters";
import { cn } from "@/lib/utils";

/**
 * RunClock (The Run): the five-day ring. It fills in blue as the run moves
 * and closes in ink at sign-off, because a person did that. Always labelled
 * "Day n, hh:mm", never a date alone. The one dial on the site.
 */
export function RunClock({
  day,
  label,
  size = 128,
  className,
}: {
  day: number;
  /** "Day 0, 09:00" or a chapter's own label such as "Since launch". */
  label: string;
  size?: number;
  className?: string;
}) {
  const fraction = clockFraction(day);
  const signed = day >= RUN_SIGN_OFF_DAY;
  const stroke = Math.max(3, Math.round(size / 16));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const big = size >= 96;

  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label}, ${signed ? "signed" : `day ${day} of ${RUN_SIGN_OFF_DAY}`}`}
        className="block"
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line, var(--rule))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={signed ? "var(--human, var(--ink))" : "var(--action, var(--blue-600))"}
          strokeWidth={stroke}
          strokeLinecap={fraction >= 1 ? "butt" : "round"}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset var(--t-quick) var(--ease), stroke var(--t-quick) var(--ease)" }}
        />
        {big ? (
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            className="wide num"
            fill="currentColor"
            fontSize={Math.round(size / 5)}
            fontWeight={600}
          >
            {label.startsWith("Day ") ? label.split(",")[0] : label}
          </text>
        ) : null}
      </svg>
      {big ? (
        <span className="num text-sm font-medium text-[color:var(--text-2, var(--slate))]">
          {label.startsWith("Day ") ? label.split(", ")[1] ?? "" : ""}
        </span>
      ) : null}
    </div>
  );
}
