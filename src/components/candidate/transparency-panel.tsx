import { transparencySections } from "@/lib/candidate/candidate-transparency";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * Plain explanation of how a candidate's information is used: what we ask
 * for, where automation is involved, where a person reviews, how to correct
 * something, retention, and how to reach a human.
 */
export function TransparencyPanel({
  company,
  title = "How your information is used",
  intro = "No surprises. Here's exactly what happens to what you send us.",
  defaultOpen,
}: {
  company?: string | null;
  title?: string;
  intro?: string;
  defaultOpen?: string;
}) {
  const sections = transparencySections(company);
  return (
    <section className="rounded-lg border bg-card p-5 sm:p-6" aria-labelledby="transparency-heading">
      <h2 id="transparency-heading" className="text-base font-semibold">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{intro}</p>

      <Accordion
        type="single"
        collapsible
        defaultValue={defaultOpen ?? "automation"}
        className="mt-3"
      >
        {sections.map((s) => (
          <AccordionItem key={s.id} value={s.id}>
            <AccordionTrigger className="text-left text-sm">{s.title}</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                {s.body.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
