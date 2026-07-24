import { Link } from "@tanstack/react-router";
import { Linkedin } from "lucide-react";
import joaoLucianoPhoto from "@/assets/founders/joao-luciano.jpg.asset.json";
import christianPhoto from "@/assets/founders/christian-brogger.jpg.asset.json";
import joaoBogoPhoto from "@/assets/founders/joao-bogo.jpg.asset.json";

/**
 * Compact founders strip — homepage trust marker.
 * Full bios live on /about; this component links there.
 * Keep in sync with LEADERS in src/routes/about.tsx.
 */
const FOUNDERS = [
  {
    name: "João Luciano",
    title: "Co-founder & CEO",
    photoUrl: joaoLucianoPhoto.url,
    linkedin: "https://www.linkedin.com/in/joaoluciano/",
  },
  {
    name: "Christian Brogger",
    title: "Co-founder & COO",
    photoUrl: christianPhoto.url,
    linkedin: "https://www.linkedin.com/in/christian-brogger/",
  },
  {
    name: "João Bogo",
    title: "Co-founder & CMO",
    photoUrl: joaoBogoPhoto.url,
    linkedin: "https://www.linkedin.com/in/joaomarcoscsilva/",
  },
] as const;

function Initials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  return (
    <div
      aria-hidden
      className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--brand-navy)] to-[color:var(--brand-ocean)] text-base font-semibold text-white"
    >
      {initials}
    </div>
  );
}

export function FoundersStrip() {
  return (
    <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-ocean)]">
            Built by operators
          </p>
          <h3 className="mt-2 font-[family-name:var(--brand-font-display)] text-2xl font-semibold tracking-tight text-[color:var(--brand-navy)]">
            The founders behind TaaSFlow.
          </h3>
          <p className="mt-2 text-sm text-[color:var(--brand-navy)]/70">
            Three operators who ran hiring at scale before building a recruiting
            function that behaves like software.
          </p>
          <Link
            to="/about"
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--brand-ocean)] hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
          >
            Meet the founders →
          </Link>
        </div>

        <ul className="flex flex-wrap items-start gap-5">
          {FOUNDERS.map((f) => (
            <li key={f.name} className="flex items-center gap-3">
              {f.photoUrl ? (
                <img
                  src={f.photoUrl}
                  alt={`${f.name}, ${f.title}`}
                  className="h-14 w-14 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <Initials name={f.name} />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[color:var(--brand-navy)]">
                  {f.name}
                </p>
                <p className="text-xs text-[color:var(--brand-navy)]/65">
                  {f.title}
                </p>
                <a
                  href={f.linkedin}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={`${f.name} on LinkedIn`}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--brand-ocean)] hover:text-[color:var(--brand-navy)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)]"
                >
                  <Linkedin className="h-3 w-3" aria-hidden />
                  LinkedIn
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
