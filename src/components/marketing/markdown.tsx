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

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-pre:overflow-x-auto prose-pre:rounded-lg prose-pre:border prose-pre:border-border/60 prose-pre:bg-muted/60 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Prevent duplicate H1s — the page header already renders the H1.
          h1: ({ children, ...rest }) => <h2 {...rest}>{children}</h2>,
          h2: ({ children, ...rest }) => <h3 {...rest}>{children}</h3>,
          h3: ({ children, ...rest }) => <h4 {...rest}>{children}</h4>,
          a: ({ href, children, ...rest }) => (
            <a href={rewriteHref(href)} {...rest}>
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
              {...rest}
            />
          ),
          // Accessible, horizontally-scrollable tables
          table: ({ children, ...rest }) => (
            <div className="my-6 w-full overflow-x-auto rounded-lg border border-border/60">
              <table
                className="w-full border-collapse text-sm"
                {...rest}
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...rest }) => (
            <th
              scope="col"
              className="border-b border-border/60 bg-muted/40 px-3 py-2 text-left font-semibold"
              {...rest}
            >
              {children}
            </th>
          ),
          td: ({ children, ...rest }) => (
            <td
              className="border-b border-border/40 px-3 py-2 align-top"
              {...rest}
            >
              {children}
            </td>
          ),
          // Accessible code blocks — inline code stays subtle, block code scrolls
          code: ({ className, children, ...rest }) => {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return (
                <code
                  className={`${className ?? ""} block whitespace-pre text-sm`}
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded bg-muted/70 px-1.5 py-0.5 text-[0.9em] font-mono"
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
