import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function slugifyHeading(input: string): string {
  return String(input)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function headingText(children: unknown): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(headingText).join("");
  if (children && typeof children === "object" && "props" in (children as any)) {
    return headingText((children as any).props?.children);
  }
  return "";
}

// Rewrite legacy source links so anchors and CTAs stay same-origin.
function rewriteHref(href?: string): string | undefined {
  if (!href) return href;
  if (href.startsWith("https://taasflow.com")) {
    return href.replace("https://taasflow.com", "") || "/";
  }
  if (href.startsWith("https://sourcing-suite-ai.lovable.app")) {
    return href.replace("https://sourcing-suite-ai.lovable.app", "") || "/";
  }
  return href;
}

/**
 * Article-grade markdown renderer.
 * Tokens (color, font, radius) come from the site design system.
 * No `prose-*` classes — the typography plugin is not installed on v4.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="taasflow-article max-w-none text-[17px] leading-[1.75] text-foreground/90 font-[family-name:var(--brand-font-body,ui-sans-serif)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // The page header already renders the H1 — demote article H1 → H2.
          h1: ({ children, ...rest }) => (
            <h2
              id={slugifyHeading(headingText(children))}
              className="scroll-mt-24 mt-14 mb-5 font-[family-name:var(--brand-font-display,inherit)] text-3xl font-semibold tracking-tight text-foreground sm:text-[2rem]"
              {...rest}
            >
              {children}
            </h2>
          ),
          h2: ({ children, ...rest }) => (
            <h3
              id={slugifyHeading(headingText(children))}
              className="scroll-mt-24 mt-12 mb-4 font-[family-name:var(--brand-font-display,inherit)] text-2xl font-semibold tracking-tight text-foreground"
              {...rest}
            >
              {children}
            </h3>
          ),
          h3: ({ children, ...rest }) => (
            <h4
              id={slugifyHeading(headingText(children))}
              className="scroll-mt-24 mt-10 mb-3 text-xl font-semibold tracking-tight text-foreground"
              {...rest}
            >
              {children}
            </h4>
          ),
          h4: ({ children, ...rest }) => (
            <h5
              className="mt-8 mb-2 text-base font-semibold uppercase tracking-widest text-muted-foreground"
              {...rest}
            >
              {children}
            </h5>
          ),
          p: ({ children, ...rest }) => (
            <p className="my-5 leading-[1.75]" {...rest}>
              {children}
            </p>
          ),
          ul: ({ children, ...rest }) => (
            <ul className="my-6 space-y-2 pl-6 [list-style:disc] marker:text-primary/70" {...rest}>
              {children}
            </ul>
          ),
          ol: ({ children, ...rest }) => (
            <ol className="my-6 space-y-2 pl-6 [list-style:decimal] marker:font-semibold marker:text-primary/80" {...rest}>
              {children}
            </ol>
          ),
          li: ({ children, ...rest }) => (
            <li className="pl-1 leading-[1.7]" {...rest}>
              {children}
            </li>
          ),
          strong: ({ children, ...rest }) => (
            <strong className="font-semibold text-foreground" {...rest}>
              {children}
            </strong>
          ),
          em: ({ children, ...rest }) => (
            <em className="italic text-foreground/85" {...rest}>
              {children}
            </em>
          ),
          hr: (props) => <hr className="my-12 border-border/60" {...props} />,
          blockquote: ({ children, ...rest }) => (
            <blockquote
              {...rest}
              className="my-8 rounded-r-lg border-l-4 border-primary/70 bg-primary/[0.05] px-6 py-5 text-[1.05rem] font-medium leading-relaxed tracking-tight text-foreground"
            >
              {children}
            </blockquote>
          ),
          a: ({ href, children, ...rest }) => (
            <a
              href={rewriteHref(href)}
              className="font-medium text-primary underline decoration-primary/30 underline-offset-4 transition hover:decoration-primary"
              {...rest}
            >
              {children}
            </a>
          ),
          img: ({ src, alt, ...rest }) => (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img
              src={src}
              alt={alt ?? ""}
              loading="lazy"
              decoding="async"
              className="my-8 w-full rounded-xl border border-border/60"
              {...rest}
            />
          ),
          table: ({ children, ...rest }) => (
            <div className="my-8 w-full overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full border-collapse text-sm" {...rest}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...rest }) => (
            <thead className="bg-muted/40" {...rest}>
              {children}
            </thead>
          ),
          th: ({ children, ...rest }) => (
            <th
              scope="col"
              className="border-b border-border/60 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              {...rest}
            >
              {children}
            </th>
          ),
          td: ({ children, ...rest }) => (
            <td className="border-b border-border/40 px-4 py-3 align-top text-sm leading-relaxed" {...rest}>
              {children}
            </td>
          ),
          pre: ({ children, ...rest }) => (
            <pre
              className="my-6 overflow-x-auto rounded-xl border border-border/60 bg-muted/60 p-4 text-sm leading-relaxed"
              {...rest}
            >
              {children}
            </pre>
          ),
          code: ({ className, children, ...rest }) => {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return (
                <code className={`${className ?? ""} block whitespace-pre text-sm`} {...rest}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded bg-muted/70 px-1.5 py-0.5 text-[0.9em] font-mono text-foreground"
                {...rest}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
