import { Linkedin } from "lucide-react";
import joaoLucianoPhoto from "@/assets/founders/joao-luciano.jpg.asset.json";
import christianPhoto from "@/assets/founders/christian-brogger.jpg.asset.json";
import joaoBogoPhoto from "@/assets/founders/joao-bogo.jpg.asset.json";

/**
 * Human escape hatch on candidate confirmation screens: real faces and direct
 * LinkedIn links, for candidates who need help before the review window closes.
 * Keep names/links in sync with src/components/marketing/founders-strip.tsx.
 */
const PEOPLE = [
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

export function ReachOutLinkedIn({ className }: { className?: string }) {
  return (
    <section
      className={`rounded-lg border p-6 ${className ?? ""}`}
      aria-labelledby="reach-out-heading"
      data-testid="reach-out-linkedin"
    >
      <h2 id="reach-out-heading" className="text-lg font-semibold">
        Need immediate help?
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Feel free to reach out to us on LinkedIn — we read our own messages.
      </p>
      <ul className="mt-5 grid gap-4 sm:grid-cols-3">
        {PEOPLE.map((p) => (
          <li key={p.name} className="flex items-center gap-3 sm:flex-col sm:text-center">
            <img
              src={p.photoUrl}
              alt={`${p.name}, ${p.title} at TaaSFlow`}
              loading="lazy"
              className="h-14 w-14 shrink-0 rounded-full object-cover sm:h-20 sm:w-20"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">{p.title}</p>
              <a
                href={p.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Linkedin className="h-3.5 w-3.5" aria-hidden="true" />
                Message on LinkedIn
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
