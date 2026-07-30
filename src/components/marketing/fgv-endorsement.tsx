import { FGV } from "@/config/ecosystem";

/** Small, non-competing FGV endorsement line. */
export function FgvEndorsement({ className }: { className?: string }) {
  return (
    <p className={className}>
      {FGV.endorsement} —{" "}
      <a
        href={FGV.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-focus-ring)] rounded"
      >
        {FGV.name}
      </a>
    </p>
  );
}
