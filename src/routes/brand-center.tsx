import { canonicalUrl } from "@/lib/canonical-origin";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer, FileDown, AlertTriangle, CheckCircle2, CircleSlash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssetCard, ScenePreview } from "@/components/brand-center/asset-card";
import { EmailSignatureBuilder } from "@/components/brand-center/email-signature";
import {
  ASSETS,
  approvedAssets,
  blockedAssets,
  buildManifest,
  byCategory,
  manifestCsv,
  reviewAssets,
} from "@/lib/brand-center/registry";
import { ACTIVE_DETECTION } from "@/lib/brand-center/detect";
import {
  AUDIENCES,
  GOVERNANCE,
  IDENTITY,
  PILLARS,
  START_HERE,
  VOICE,
  WORDS_TO_AVOID,
  WORDS_TO_USE,
  WRITING_PRINCIPLES,
} from "@/lib/brand-center/messaging";
import { BRAND_COLORS, C, CONTRAST_RESULTS } from "@/lib/brand-center/palette";
import { VISUAL_SYSTEMS, clearSpaceDiagram, gridDiagram, LOGO } from "@/lib/brand-center/templates";
import { brand } from "@/config/brand";
import { triggerDownload } from "@/lib/brand-center/scene";
import { SiteFooter } from "@/components/marketing/site-shell";

const CANONICAL = canonicalUrl("/brand-center");
const TITLE = "TaaSFlow Brand Center — logos, messaging, assets";
const DESCRIPTION =
  "Approved TaaSFlow positioning and messaging, logo rules, colour and type tokens, plus exact-dimension social and document assets to download.";

export const Route = createFileRoute("/brand-center")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: CANONICAL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: CANONICAL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "TaaSFlow",
          url: "https://taasflow.com",
          logo: "https://taasflow.com/og-image.png",
          slogan: IDENTITY.tagline,
          description: IDENTITY.shortDescription,
        }),
      },
    ],
  }),
  component: BrandCenter,
});

const SECTIONS = [
  { id: "start", label: "Start here" },
  { id: "strategy", label: "Strategy" },
  { id: "messaging", label: "Messaging" },
  { id: "voice", label: "Voice and writing" },
  { id: "logo", label: "Logo system" },
  { id: "color", label: "Colour" },
  { id: "type", label: "Typography" },
  { id: "layout", label: "Spacing, grid, buttons" },
  { id: "visual", label: "Visual language" },
  { id: "social", label: "Social assets" },
  { id: "campaign", label: "Campaign templates" },
  { id: "docs", label: "Presentations and documents" },
  { id: "email", label: "Email signature" },
  { id: "icons", label: "Icons and sharing" },
  { id: "downloads", label: "Downloads and manifest" },
];

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 break-inside-avoid border-t border-border py-12 first:border-t-0">
      <h2 className="font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {intro && <p className="mt-2 max-w-2xl text-muted-foreground">{intro}</p>}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

function BrandCenter() {
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") setPrintMode(true);
  }, []);

  const detection = ACTIVE_DETECTION;

  if (detection.status !== "verified") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="text-2xl font-semibold">Brand detection halted</h1>
        <p className="mt-3 text-muted-foreground">
          Asset generation stops until exactly one brand is confirmed by at least two agreeing signals.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {detection.allSignals.map((s) => (
            <li key={s.source} className="rounded-lg border border-border p-3">
              <strong>{s.source}</strong>: {s.value} → {s.brandId ?? "no brand id"}
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <>
    <main
      data-brand-print={printMode ? "1" : undefined}
      className="mx-auto max-w-6xl px-5 pb-24 sm:px-8"
    >
      {/* Header */}
      <header className="pt-14">
        <div className="flex flex-wrap items-center gap-3">
          <img src={LOGO.light} alt="TaaSFlow" width={149} height={36} className="h-9 w-auto dark:hidden" />
          <img src={LOGO.dark} alt="TaaSFlow" width={149} height={36} loading="lazy" decoding="async" className="hidden h-9 w-auto dark:block" />
          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
            Brand Center v{GOVERNANCE.version}
          </span>
        </div>
        <h1 className="mt-6 max-w-3xl font-[family-name:var(--brand-font-display)] text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {IDENTITY.promise}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{IDENTITY.shortDescription}</p>
        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          <Button className="min-h-11" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Print or save the brand guide as PDF
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() =>
              triggerDownload(
                new Blob([manifestCsv()], { type: "text/csv;charset=utf-8" }),
                `${IDENTITY.brandId}_asset-manifest_v${GOVERNANCE.version}.csv`,
              )
            }
          >
            <FileDown className="size-4" aria-hidden /> Download asset manifest CSV
          </Button>
          <Button asChild variant="ghost" className="min-h-11">
            <Link to="/">Back to taasflow.com</Link>
          </Button>
        </div>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground">Owner</dt><dd className="font-medium">{GOVERNANCE.owner}</dd></div>
          <div><dt className="text-muted-foreground">Last updated</dt><dd className="font-medium">{GOVERNANCE.updatedAt}</dd></div>
          <div>
            <dt className="text-muted-foreground">Brand detection</dt>
            <dd className="font-medium">
              Verified · {detection.brandId} ({detection.agreeingSignals.length} agreeing signals)
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-10 gap-10 lg:grid lg:grid-cols-[220px_1fr]">
        {/* Nav */}
        <nav aria-label="Brand center sections" className="mb-8 lg:mb-0 print:hidden">
          <div className="lg:sticky lg:top-20">
            <label className="block lg:hidden">
              <span className="text-sm font-medium">Jump to section</span>
              <select
                className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3"
                onChange={(e) => {
                  document.getElementById(e.target.value)?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {SECTIONS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
            <ul className="hidden space-y-1 text-sm lg:block">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-ocean)]"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div>
          {/* 1 Start here */}
          <Section id="start" title="Start here" intro="Pick the task you came to do.">
            <ul className="grid gap-3 sm:grid-cols-2">
              {START_HERE.map((row) => (
                <li key={row.task} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-semibold text-foreground">{row.task}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{row.note}</p>
                  <p className="mt-2 text-sm font-medium text-[color:var(--brand-ocean-text)]">→ {row.goTo}</p>
                </li>
              ))}
            </ul>
          </Section>

          {/* 2 Strategy */}
          <Section id="strategy" title="Strategy" intro="What TaaSFlow is, who it is for, and what it promises.">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Category", IDENTITY.category],
                ["Purpose", IDENTITY.purpose],
                ["Positioning", IDENTITY.positioning],
                ["Brand promise", IDENTITY.promise],
              ].map(([label, body]) => (
                <div key={label} className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
                  <p className="mt-2 text-foreground">{body}</p>
                </div>
              ))}
            </div>

            <h3 className="pt-2 text-xl font-semibold">Primary audiences</h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {AUDIENCES.map((aud) => (
                <li key={aud.name} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-semibold">{aud.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{aud.description}</p>
                  <p className="mt-2 text-sm"><span className="font-medium">Cares about: </span>{aud.cares}</p>
                </li>
              ))}
            </ul>

            <h3 className="pt-2 text-xl font-semibold">Messaging pillars</h3>
            <ol className="grid gap-3 sm:grid-cols-2">
              {PILLARS.map((p, i) => (
                <li key={p.title} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold text-[color:var(--brand-ocean-text)]">Pillar {i + 1}</p>
                  <p className="mt-1 font-semibold">{p.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
                  <p className="mt-2 text-sm">{p.proof}</p>
                </li>
              ))}
            </ol>

            <div className="rounded-xl border border-[color:var(--brand-warning)] bg-card p-4">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" aria-hidden /> Parent-company line</p>
              <p className="mt-1 text-sm text-muted-foreground">
                “{IDENTITY.parentLine}” — {IDENTITY.parentStatus}
              </p>
            </div>
          </Section>

          {/* 3 Messaging */}
          <Section id="messaging" title="Messaging" intro="Approved copy. Use these verbatim; do not paraphrase into new claims.">
            {[
              ["Approved tagline", IDENTITY.tagline],
              ["Elevator pitch", IDENTITY.elevatorPitch],
              ["Short description", IDENTITY.shortDescription],
              ["Medium description", IDENTITY.mediumDescription],
              ["Full description", IDENTITY.fullDescription],
            ].map(([label, body]) => (
              <CopyBlock key={label} label={label} body={body} />
            ))}
            <p className="text-sm text-muted-foreground">{IDENTITY.legalNote}</p>
          </Section>

          {/* 4 Voice */}
          <Section id="voice" title="Voice and writing" intro={VOICE.summary}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {VOICE.attributes.map((attr) => (
                <li key={attr.trait} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-semibold">{attr.trait}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{attr.detail}</p>
                </li>
              ))}
            </ul>
            <h3 className="pt-2 text-xl font-semibold">Writing principles</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-foreground">
              {WRITING_PRINCIPLES.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" aria-hidden /> Words to use</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {WORDS_TO_USE.map((w) => (
                    <li key={w.term}><span className="font-medium">{w.term}</span> — <span className="text-muted-foreground">{w.why}</span></li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="flex items-center gap-2 font-semibold"><CircleSlash className="size-4" aria-hidden /> Words to avoid</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {WORDS_TO_AVOID.map((w) => (
                    <li key={w.term}><span className="font-medium">{w.term}</span> — <span className="text-muted-foreground">{w.why}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          {/* 5 Logo */}
          <Section id="logo" title="Logo system" intro="The approved masters are never redrawn, recoloured or rebuilt. Everything below derives from them.">
            <div className="grid gap-4 sm:grid-cols-3">
              {byCategory("logo").filter((x) => x.fileUrl).map((asset) => (
                <AssetCard key={asset.name} asset={asset} />
              ))}
            </div>

            <h3 className="pt-2 text-xl font-semibold">Clear space</h3>
            <ScenePreview scene={clearSpaceDiagram()} alt="Clear space equals the wordmark cap height on all four sides" maxHeight={280} />
            <p className="text-sm text-muted-foreground">
              x = the cap height of the wordmark. Keep x of clear space on all four sides. Nothing — type, edges, photography or other marks — enters that area.
            </p>

            <h3 className="pt-2 text-xl font-semibold">Minimum sizes</h3>
            <div className="flex flex-wrap items-end gap-8 rounded-xl border border-border bg-card p-5">
              {[
                { label: "Full lockup — digital minimum", w: 120 },
                { label: "Full lockup — comfortable", w: 180 },
              ].map((s) => (
                <div key={s.label}>
                  <img src={LOGO.light} alt={`TaaSFlow wordmark at ${s.w}px wide`} width={s.w} height={Math.round(s.w / 4.15)} loading="lazy" decoding="async" style={{ width: s.w }} className="dark:hidden" />
                  <img src={LOGO.dark} alt="" aria-hidden width={s.w} height={Math.round(s.w / 4.15)} loading="lazy" decoding="async" style={{ width: s.w }} className="hidden dark:block" />
                  <p className="mt-2 text-xs text-muted-foreground">{s.label} — {s.w}px</p>
                </div>
              ))}
              <div>
                <div className="flex items-center gap-3">
                  {[16, 24, 32].map((s) => (
                    <img key={s} src={LOGO.icon} alt={`TaaSFlow symbol at ${s}px`} width={s} height={s} loading="lazy" decoding="async" style={{ width: s }} className="rounded bg-[color:var(--brand-navy-dark)] p-0.5" />
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Symbol — 16px absolute minimum</p>
              </div>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Full lockup: 120px minimum width on screen; 30mm minimum in print.</li>
              <li>Below 120px the wordmark stops resolving — switch to the symbol.</li>
              <li>Symbol: 16px minimum on screen; 8mm in print.</li>
            </ul>

            <h3 className="pt-2 text-xl font-semibold">Incorrect use</h3>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Do not stretch or squash", style: { transform: "scaleX(1.45)", transformOrigin: "left center" } as React.CSSProperties, alt: "Wordmark horizontally stretched so letterforms are distorted" },
                { label: "Do not recolour", style: { filter: "hue-rotate(120deg) saturate(2)" }, alt: "Wordmark recoloured green, outside the approved palette" },
                { label: "Do not rotate", style: { transform: "rotate(-8deg)" }, alt: "Wordmark rotated off the horizontal" },
                { label: "Do not add effects", style: { filter: "drop-shadow(0 6px 6px rgba(0,0,0,.55))" }, alt: "Wordmark with a drop shadow applied" },
                { label: "Do not place on low-contrast or busy backgrounds", style: {}, alt: "Wordmark on a mid-tone busy background where it loses contrast", busy: true },
                { label: "Do not crop", style: { clipPath: "inset(0 26% 0 0)" }, alt: "Wordmark cropped so the end of the word is cut off" },
              ].map((bad) => (
                <li key={bad.label} className="rounded-xl border border-destructive/50 bg-card p-4">
                  <div
                    className="flex h-20 items-center overflow-hidden rounded-lg p-3"
                    style={bad.busy ? { background: `repeating-linear-gradient(45deg, ${C.slate}, ${C.slate} 10px, ${C.navyLight} 10px, ${C.navyLight} 20px)` } : { background: C.paper }}
                  >
                    <img src={LOGO.light} alt={bad.alt} loading="lazy" decoding="async" className="h-6 w-auto" style={bad.style} />
                  </div>
                  <p className="mt-2 text-sm font-medium text-destructive">✕ {bad.label}</p>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Every example above is a live CSS distortion of a copy of the master, shown only inside this “do not” context. The master files are untouched.
            </p>
          </Section>

          {/* 6 Colour */}
          <Section id="color" title="Colour" intro="Values are the sRGB resolution of the OKLCH design tokens in the product. CMYK is a starting reference only.">
            {(["primary", "secondary", "status"] as const).map((group) => (
              <div key={group}>
                <h3 className="text-xl font-semibold capitalize">{group} palette</h3>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {BRAND_COLORS.filter((c) => c.group === group).map((c) => (
                    <li key={c.token} className="overflow-hidden rounded-xl border border-border bg-card">
                      <div className="h-16 w-full" style={{ background: c.hex }} aria-hidden />
                      <div className="p-4">
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-sm text-muted-foreground">{c.role}</p>
                        <dl className="mt-2 space-y-0.5 font-[family-name:var(--brand-font-mono)] text-xs">
                          <div>{c.hex}</div>
                          <div>rgb({c.rgb.join(", ")})</div>
                          <div className="text-muted-foreground">--{c.token}</div>
                        </dl>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">
              CMYK: convert from the sRGB values above in your layout tool and treat the result as a starting reference — verify with the printer and a proof. No Pantone match is specified because none has been approved.
            </p>

            <h3 className="pt-2 text-xl font-semibold">Accessible combinations</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <caption className="sr-only">Contrast ratios for approved foreground and background pairs</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="py-2 pr-3">Combination</th>
                    <th scope="col" className="py-2 pr-3">Ratio</th>
                    <th scope="col" className="py-2 pr-3">Normal text AA</th>
                    <th scope="col" className="py-2 pr-3">Large text AA</th>
                    <th scope="col" className="py-2">Use for</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTRAST_RESULTS.map((r) => (
                    <tr key={r.label} className="border-b border-border/60">
                      <th scope="row" className="py-2 pr-3 text-left font-medium">
                        <span className="mr-2 inline-block rounded px-2 py-0.5" style={{ background: r.bgHex, color: r.fgHex }}>Aa</span>
                        {r.label}
                      </th>
                      <td className="py-2 pr-3 font-[family-name:var(--brand-font-mono)]">{r.ratio.toFixed(2)}:1</td>
                      <td className="py-2 pr-3">{r.normalAA ? "✓ Pass" : "✕ Fail"}</td>
                      <td className="py-2 pr-3">{r.largeAA ? "✓ Pass" : "✕ Fail"}</td>
                      <td className="py-2 text-muted-foreground">{r.usage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* 7 Typography */}
          <Section id="type" title="Typography" intro="Fraunces for display, Inter for interface and body, JetBrains Mono for data. Fonts are licensed under the SIL Open Font License and loaded from the web — they are not redistributed here.">
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <caption className="sr-only">Type scale</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="p-3">Role</th>
                    <th scope="col" className="p-3">Family</th>
                    <th scope="col" className="p-3">Size / line</th>
                    <th scope="col" className="p-3">Weight · tracking</th>
                    <th scope="col" className="p-3">Sample</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(brand.typography.scale).map(([role, s]) => {
                    const display = ["display", "h1", "h2", "h3", "h4"].includes(role);
                    return (
                      <tr key={role} className="border-b border-border/60">
                        <th scope="row" className="p-3 text-left font-medium">{role}</th>
                        <td className="p-3">{display ? "Fraunces" : role === "meta" ? "Inter" : "Inter"}</td>
                        <td className="p-3 font-[family-name:var(--brand-font-mono)]">{s.size}px / {s.line}</td>
                        <td className="p-3 font-[family-name:var(--brand-font-mono)]">{s.weight} · {s.tracking}</td>
                        <td className="p-3">
                          <span
                            style={{
                              fontSize: Math.min(s.size, 34),
                              lineHeight: s.line,
                              letterSpacing: s.tracking,
                              fontWeight: s.weight,
                              fontFamily: display ? "var(--brand-font-display)" : "var(--brand-font-sans)",
                            }}
                          >
                            Ranked shortlists
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">
              Fallback stacks: display → Iowan Old Style, Georgia, serif. Interface → system-ui, Segoe UI, sans-serif. Data → ui-monospace, SF Mono, monospace.
            </p>
          </Section>

          {/* 8 Layout */}
          <Section id="layout" title="Spacing, grid and buttons">
            <div>
              <h3 className="text-xl font-semibold">Spacing scale</h3>
              <ul className="mt-3 flex flex-wrap items-end gap-3">
                {brand.spacing.scale.map((s) => (
                  <li key={s} className="text-center">
                    <div className="rounded bg-[color:var(--brand-ocean)]" style={{ width: s, height: s }} aria-hidden />
                    <span className="mt-1 block font-[family-name:var(--brand-font-mono)] text-xs">{s}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">Base unit 4px. Component padding steps at 12/16/20/24. Section rhythm at 48/64/80/96.</p>
            </div>

            <div>
              <h3 className="text-xl font-semibold">Grid</h3>
              <ScenePreview scene={gridDiagram()} alt="Twelve column grid with 20px gutters inside a 1200px content width" maxHeight={240} />
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Public pages max 1200px; workspace max 1440px; prose max 68ch.</li>
                <li>Gutters: 20px mobile, 24px tablet, 32px desktop.</li>
                <li>Twelve columns desktop, six tablet, four mobile. Cards snap to column boundaries.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold">Buttons</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {Object.entries(brand.buttons).map(([key, def]) => (
                  <div key={key} className="rounded-xl border border-border bg-card p-4">
                    <p className="font-semibold capitalize">{key} — {def.role}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{def.usage}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button className="min-h-11" variant={key === "primary" ? "default" : key === "secondary" ? "secondary" : key === "danger" ? "destructive" : key === "link" ? "link" : "ghost"}>
                        Default
                      </Button>
                      <Button className="min-h-11" disabled variant={key === "primary" ? "default" : "outline"}>Disabled</Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Every interactive target is at least 44 × 44px. Focus is a 2px Ocean ring at 2px offset, never removed.
              </p>
            </div>
          </Section>

          {/* 9 Visual language */}
          <Section id="visual" title="Visual language" intro="Three systems, one brand. They share the logo rules, type, palette and grid, and differ in structure — not colour.">
            <ul className="grid gap-3 sm:grid-cols-3">
              {VISUAL_SYSTEMS.map((s) => (
                <li key={s.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold text-[color:var(--brand-ocean-text)]">System {s.id}</p>
                  <p className="mt-1 font-semibold">{s.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                </li>
              ))}
            </ul>

            <div className="grid gap-4 lg:grid-cols-2">
              <GuideCard
                title="Iconography"
                items={[
                  "Lucide, 1.75px stroke, rounded caps.",
                  "Allowed sizes: 12, 14, 16, 18, 20, 24, 28, 32. Never freeform.",
                  "Icons support labels; they never replace them in navigation or actions.",
                  "No filled pictograms, no multi-colour icons, no emoji in product UI.",
                ]}
              />
              <GuideCard
                title="Illustration"
                items={[
                  "Diagrammatic, not decorative: stages, routes, evidence rows, ranked lists.",
                  "Built from the palette and the grid; strokes match the icon stroke weight.",
                  "No mascots, no isometric office scenes, no abstract blobs.",
                ]}
              />
              <GuideCard
                title="Photography"
                items={[
                  "Real working environments and real people at work — interviews, small teams, focused desks.",
                  "Natural light, restrained colour, generous negative space for overlays.",
                  "No handshake stock, no resume piles, no staged high-fives, no fake dashboards.",
                  "Minimum 1600px on the long edge.",
                ]}
              />
              <GuideCard
                title="Motion"
                items={[
                  "Purpose only: reveal structure, confirm a state change, sequence data.",
                  "Durations 120–240ms for state, up to 400ms for entrance. Easing: cubic-bezier(0.2, 0, 0, 1).",
                  "Respect prefers-reduced-motion: replace movement with an instant state change.",
                  "No scroll hijacking, cursor replacement, autoplay audio, or particle backgrounds.",
                ]}
              />
              <GuideCard
                title="Data visualisation"
                items={[
                  `Series order: Ocean ${C.ocean}, Navy ${C.navy}, Ocean Light ${C.oceanLight}, Sky Deep ${C.skyDark}.`,
                  "Axes start at zero. Units, source and date on every chart.",
                  "Missing data is labelled “no data”, never interpolated or hidden.",
                  "Never encode meaning by colour alone — pair with a label, glyph or pattern.",
                  "No 3D, no decorative gauges, no truncated axes.",
                ]}
              />
              <GuideCard
                title="Image-generation direction"
                items={[
                  "Subject: recruiters, hiring managers and candidates in real work settings.",
                  "Environment: modern but ordinary offices, meeting rooms, home desks.",
                  "Composition: 16:9 or 3:2, subject off-centre, clear negative space for overlay type.",
                  "Lighting: soft daylight, low contrast, no heavy colour grade.",
                  "Material and colour: cool neutrals that sit with Navy, Ocean and Sky.",
                  "Human representation: mixed ages and backgrounds, natural posture, no forced smiles.",
                  "Motif: structure and sequence — a board, a list, a shortlist on screen (unreadable).",
                  "Negative: no logos, no readable interface text, no copyrighted characters, no invented client names, no robots, no glowing brains.",
                  "Never render brand typography into a generated image — type is always applied in layout.",
                ]}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Generated imagery is stored with its prompt, tool, creation date, usage note and review status, and requires human approval before it joins the approved library. Templates with an unfilled image slot stay at review status and are never exported as final.
            </p>
          </Section>

          {/* 10 Social */}
          <Section id="social" title="Social assets" intro="Exact-dimension templates with working PNG export. Toggle safe areas on any template that has platform overlap.">
            <h3 className="text-xl font-semibold">LinkedIn</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              {byCategory("social-linkedin").map((asset) => <AssetCard key={asset.name} asset={asset} />)}
            </div>
            <h3 className="pt-4 text-xl font-semibold">Instagram</h3>
            <div className="grid gap-4 lg:grid-cols-3">
              {byCategory("social-instagram").map((asset) => <AssetCard key={asset.name} asset={asset} />)}
            </div>
            <h3 className="pt-4 text-xl font-semibold">X, Facebook, YouTube</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              {byCategory("social-other").map((asset) => <AssetCard key={asset.name} asset={asset} />)}
            </div>
          </Section>

          {/* 11 Campaign */}
          <Section id="campaign" title="Campaign templates" intro="Templates with editable fields stay at review status until those fields are filled. Results tiles ship empty on purpose.">
            <div className="grid gap-4 lg:grid-cols-2">
              {byCategory("campaign").map((asset) => <AssetCard key={asset.name} asset={asset} />)}
            </div>
          </Section>

          {/* 12 Presentations and documents */}
          <Section id="docs" title="Presentations and documents">
            <div className="grid gap-4 lg:grid-cols-2">
              {[...byCategory("presentation"), ...byCategory("document")].map((asset) => (
                <AssetCard key={asset.name} asset={asset} />
              ))}
            </div>
          </Section>

          {/* 13 Email */}
          <Section id="email" title="Email signature" intro="Editable fields, table layout, no hardcoded personal details.">
            <EmailSignatureBuilder />
          </Section>

          {/* 14 Icons and sharing */}
          <Section id="icons" title="Icons and website sharing" intro="Favicon, app icons and the default Open Graph image.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...byCategory("icon"), ...byCategory("og")].map((asset) => <AssetCard key={asset.name} asset={asset} />)}
            </div>
            <p className="text-sm text-muted-foreground">
              The live site keeps its current favicon and share image until an owner verifies these exports and swaps them deliberately — replacing them here would change every existing share preview.
            </p>
          </Section>

          {/* 15 Downloads */}
          <Section id="downloads" title="Downloads and manifest" intro="Approved assets are listed first. Review and blocked items are separated and excluded from the official pack.">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-semibold">Approved pack — {approvedAssets().length} assets</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Downloads are generated one file at a time, on demand, so nothing heavy loads with the page. There is no ZIP button because bundling is not supported here — use the per-asset downloads in each section above.
              </p>
              <Button
                className="mt-3 min-h-11"
                variant="outline"
                onClick={() =>
                  triggerDownload(
                    new Blob([manifestCsv()], { type: "text/csv;charset=utf-8" }),
                    `${IDENTITY.brandId}_asset-manifest_v${GOVERNANCE.version}.csv`,
                  )
                }
              >
                <FileDown className="size-4" aria-hidden /> Download asset manifest CSV
              </Button>
            </div>

            {reviewAssets().length > 0 && (
              <div className="rounded-xl border border-[color:var(--brand-warning)] bg-card p-4">
                <p className="font-semibold">In review — {reviewAssets().length} assets</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Excluded from the official pack. Each carries an unfilled editable field or awaits an approval outside this project.
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {reviewAssets().map((x) => <li key={x.name}>{x.name} — {x.notes}</li>)}
                </ul>
              </div>
            )}

            {blockedAssets().length > 0 && (
              <div className="rounded-xl border border-destructive bg-card p-4">
                <p className="font-semibold">Blocked — {blockedAssets().length} assets</p>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {blockedAssets().map((x) => <li key={x.name}>{x.name} — {x.notes}</li>)}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <caption className="sr-only">Asset manifest</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Filename", "Category", "Dimensions", "Format", "Version", "Status", "Updated"].map((h) => (
                      <th key={h} scope="col" className="py-2 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buildManifest().map((row) => (
                    <tr key={`${row.filename}-${row.format}`} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-[family-name:var(--brand-font-mono)] text-xs">{row.filename}</td>
                      <td className="py-2 pr-3">{row.category}</td>
                      <td className="py-2 pr-3">{row.dimensions}</td>
                      <td className="py-2 pr-3 uppercase">{row.format}</td>
                      <td className="py-2 pr-3">v{row.version}</td>
                      <td className="py-2 pr-3">{row.status}</td>
                      <td className="py-2 pr-3">{row.updatedAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">
              {ASSETS.length} registry entries · owner {GOVERNANCE.owner} · {GOVERNANCE.cadence}
            </p>
          </Section>
        </div>
      </div>
    </main>
    <SiteFooter />
    </>
  );
}

function CopyBlock({ label, body }: { label: string; body: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
        <Button
          size="sm"
          variant="ghost"
          className="min-h-11 print:hidden"
          onClick={async () => {
            await navigator.clipboard.writeText(body);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? "Copied" : `Copy ${label.toLowerCase()}`}
        </Button>
      </div>
      <p className="mt-2 text-foreground">{body}</p>
    </div>
  );
}

function GuideCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-xl font-semibold">{title}</h3>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </div>
  );
}
