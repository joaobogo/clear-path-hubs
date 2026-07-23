import type { IndustryPattern } from "@/content/industry-visual-identity";

/**
 * Reusable themed hero backdrop used by the industry landing template when
 * the industry has no bespoke hero image. Each pattern is a lightweight
 * SVG rendered on top of a `bg-gradient-to-br <gradient>` container.
 */

function Circuit() {
  return (
    <svg aria-hidden viewBox="0 0 400 240" className="absolute inset-0 h-full w-full opacity-[0.22]" preserveAspectRatio="none">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M0,60 L120,60 L140,80 L260,80 L280,60 L400,60" />
        <path d="M0,120 L80,120 L100,100 L200,100 L220,120 L400,120" />
        <path d="M0,180 L60,180 L80,200 L340,200 L360,180 L400,180" />
      </g>
      {Array.from({ length: 20 }).map((_, i) => (
        <circle key={i} cx={(i * 41) % 400} cy={40 + ((i * 47) % 180)} r="2.5" fill="currentColor" opacity="0.7" />
      ))}
    </svg>
  );
}

function Grid() {
  return (
    <svg aria-hidden viewBox="0 0 400 240" className="absolute inset-0 h-full w-full opacity-[0.18]" preserveAspectRatio="none">
      <defs>
        <pattern id="p-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0 L0 0 L0 28" fill="none" stroke="currentColor" strokeWidth="0.75" />
        </pattern>
      </defs>
      <rect width="400" height="240" fill="url(#p-grid)" />
    </svg>
  );
}

function Waves() {
  return (
    <svg aria-hidden viewBox="0 0 400 240" className="absolute inset-0 h-full w-full opacity-[0.25]" preserveAspectRatio="none">
      {[60, 100, 140, 180].map((y, i) => (
        <path
          key={y}
          d={`M0,${y} Q100,${y - 30} 200,${y} T400,${y}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5 - i * 0.2}
          opacity={0.9 - i * 0.15}
        />
      ))}
    </svg>
  );
}

function Hex() {
  return (
    <svg aria-hidden viewBox="0 0 400 240" className="absolute inset-0 h-full w-full opacity-[0.22]" preserveAspectRatio="none">
      <defs>
        <pattern id="p-hex" x="0" y="0" width="40" height="34.64" patternUnits="userSpaceOnUse">
          <polygon points="20,2 38,12 38,32 20,42 2,32 2,12" fill="none" stroke="currentColor" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="400" height="240" fill="url(#p-hex)" />
    </svg>
  );
}

function Columns() {
  return (
    <svg aria-hidden viewBox="0 0 400 240" className="absolute inset-0 h-full w-full opacity-[0.20]" preserveAspectRatio="none">
      {Array.from({ length: 7 }).map((_, i) => (
        <g key={i} transform={`translate(${i * 60 + 22},40)`}>
          <rect x="0" y="0" width="24" height="6" fill="currentColor" />
          <rect x="4" y="6" width="16" height="140" fill="currentColor" opacity="0.7" />
          <rect x="0" y="146" width="24" height="6" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

function Gears() {
  return (
    <svg aria-hidden viewBox="0 0 400 240" className="absolute inset-0 h-full w-full opacity-[0.20]" preserveAspectRatio="none">
      {[
        { cx: 80, cy: 120, r: 40 },
        { cx: 200, cy: 90, r: 28 },
        { cx: 310, cy: 150, r: 46 },
      ].map((g, i) => (
        <g key={i} transform={`translate(${g.cx},${g.cy})`}>
          <circle r={g.r} fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle r={g.r / 3} fill="currentColor" opacity="0.6" />
          {Array.from({ length: 10 }).map((_, j) => (
            <rect key={j} x="-2" y={-g.r - 6} width="4" height="8" fill="currentColor" transform={`rotate(${j * 36})`} />
          ))}
        </g>
      ))}
    </svg>
  );
}

function Leaves() {
  return (
    <svg aria-hidden viewBox="0 0 400 240" className="absolute inset-0 h-full w-full opacity-[0.22]" preserveAspectRatio="none">
      {Array.from({ length: 14 }).map((_, i) => {
        const cx = (i * 61) % 400;
        const cy = 30 + ((i * 53) % 180);
        const rot = (i * 47) % 360;
        return (
          <g key={i} transform={`translate(${cx},${cy}) rotate(${rot})`}>
            <path d="M0,0 Q10,-14 22,0 Q10,14 0,0 Z" fill="currentColor" opacity="0.7" />
            <path d="M0,0 L22,0" stroke="currentColor" strokeWidth="0.5" />
          </g>
        );
      })}
    </svg>
  );
}

function Dots() {
  return (
    <svg aria-hidden viewBox="0 0 400 240" className="absolute inset-0 h-full w-full opacity-[0.24]" preserveAspectRatio="none">
      <defs>
        <pattern id="p-dots" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="11" cy="11" r="1.6" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="400" height="240" fill="url(#p-dots)" />
    </svg>
  );
}

function Bars() {
  return (
    <svg aria-hidden viewBox="0 0 400 240" className="absolute inset-0 h-full w-full opacity-[0.22]" preserveAspectRatio="none">
      {Array.from({ length: 16 }).map((_, i) => (
        <rect
          key={i}
          x={i * 25 + 6}
          y={220 - ((i * 37) % 140) - 10}
          width="14"
          height={((i * 37) % 140) + 10}
          fill="currentColor"
          opacity={0.55}
        />
      ))}
    </svg>
  );
}

function Molecule() {
  return (
    <svg aria-hidden viewBox="0 0 400 240" className="absolute inset-0 h-full w-full opacity-[0.24]" preserveAspectRatio="none">
      {[
        [60, 80], [140, 60], [220, 100], [310, 70], [90, 170], [200, 190], [300, 160], [360, 200],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={((i % 3) + 2) * 2} fill="currentColor" opacity="0.8" />
      ))}
      <g stroke="currentColor" strokeWidth="1" opacity="0.6">
        <line x1="60" y1="80" x2="140" y2="60" />
        <line x1="140" y1="60" x2="220" y2="100" />
        <line x1="220" y1="100" x2="310" y2="70" />
        <line x1="90" y1="170" x2="200" y2="190" />
        <line x1="200" y1="190" x2="300" y2="160" />
        <line x1="300" y1="160" x2="360" y2="200" />
        <line x1="140" y1="60" x2="200" y2="190" />
        <line x1="220" y1="100" x2="300" y2="160" />
      </g>
    </svg>
  );
}

function Windows() {
  return (
    <svg aria-hidden viewBox="0 0 400 240" className="absolute inset-0 h-full w-full opacity-[0.20]" preserveAspectRatio="none">
      <defs>
        <pattern id="p-windows" x="0" y="0" width="28" height="34" patternUnits="userSpaceOnUse">
          <rect x="6" y="8" width="16" height="20" rx="1.5" fill="currentColor" opacity="0.7" />
        </pattern>
      </defs>
      <rect width="400" height="240" fill="url(#p-windows)" />
    </svg>
  );
}

function Chart() {
  return (
    <svg aria-hidden viewBox="0 0 400 240" className="absolute inset-0 h-full w-full opacity-[0.24]" preserveAspectRatio="none">
      <polyline
        points="0,180 40,160 80,170 120,120 160,140 200,90 240,110 280,70 320,85 360,40 400,55"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect
          key={i}
          x={i * 34 + 6}
          y={200 - (i % 4) * 12 - 8}
          width="14"
          height={(i % 4) * 12 + 8}
          fill="currentColor"
          opacity="0.32"
        />
      ))}
    </svg>
  );
}

const REGISTRY: Record<IndustryPattern, () => JSX.Element> = {
  circuit: Circuit,
  grid: Grid,
  waves: Waves,
  hex: Hex,
  columns: Columns,
  gears: Gears,
  leaves: Leaves,
  dots: Dots,
  bars: Bars,
  molecule: Molecule,
  windows: Windows,
  chart: Chart,
};

export function IndustryHeroBackdrop({
  gradient,
  accent,
  pattern,
  label,
  eyebrow,
}: {
  gradient: string;
  accent: string;
  pattern: IndustryPattern;
  label: string;
  eyebrow?: string;
}) {
  const P = REGISTRY[pattern] ?? Grid;
  return (
    <figure
      className={`relative aspect-[2/1] w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${gradient} shadow-lg motion-safe:animate-[taas-reveal-up_520ms_var(--taas-ease-emphasized)_both] lg:aspect-auto lg:h-full lg:min-h-[360px]`}
      aria-hidden
    >
      <div className={accent}>
        <P />
      </div>
      {/* Vignette + subtle noise */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_90%,rgba(0,0,0,0.35),transparent_60%)]" />
      {/* Centered label chip */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 text-white sm:p-7">
        <div>
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {eyebrow}
            </p>
          ) : null}
          <p className="mt-1 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight sm:text-3xl">
            {label}
          </p>
        </div>
        <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white backdrop-blur">
          Industry
        </span>
      </div>
    </figure>
  );
}
