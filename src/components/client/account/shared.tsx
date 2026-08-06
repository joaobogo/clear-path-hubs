import { AlertCircle, Info } from "lucide-react";
import { Label } from "@/components/ui/label";

export function BannerAmber({ children }: { children: React.ReactNode }) {
 return (
 <div className="flex items-start gap-2 rounded-lg border taas-bd-warning taas-bg-warning-solid/[0.05] px-3 py-2 text-sm">
 <Info className="mt-0.5 h-4 w-4 shrink-0 taas-fg-warning" />
 <span>{children}</span>
 </div>
 );
}

export function SectionCard({
 icon,
 title,
 description,
 children,
}: {
 icon: React.ReactNode;
 title: string;
 description?: string;
 children: React.ReactNode;
}) {
 return (
 <section className="rounded-xl border bg-card">
 <header className="flex items-start gap-3 border-b px-5 py-4">
 <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
 {icon}
 </div>
 <div className="min-w-0">
 <h2 className="text-base font-semibold">{title}</h2>
 {description && (
 <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
 )}
 </div>
 </header>
 <div className="p-5">{children}</div>
 </section>
 );
}

export function Field({
 id,
 label,
 required,
 error,
 hint,
 children,
}: {
 id: string;
 label: string;
 required?: boolean;
 error?: string;
 hint?: string;
 children: React.ReactNode;
}) {
 return (
 <div className="min-w-0 space-y-1.5">
 <Label htmlFor={id} className="text-sm">
 {label}
 {required && <span className="ml-0.5 text-destructive">*</span>}
 </Label>
 {children}
 {error ? (
 <p className="flex items-center gap-1 text-xs text-destructive">
 <AlertCircle className="h-3 w-3" />
 {error}
 </p>
 ) : hint ? (
 <p className="text-xs text-muted-foreground">{hint}</p>
 ) : null}
 </div>
 );
}
