import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Rewrite legacy source links so anchors and CTAs stay same-origin.
function rewriteHref(href?: string): string | undefined {
  if (!href) return href;
  if (href.startsWith("https://taasflow.com")) {
    return href.replace("https://taasflow.com", "") || "/";
  }
  if (href.startsWith("https://sourcing-suite-ai.lovable.app")) {
    return href.replace("https://sourcing-suite-ai.lovable.app", "") || "/";
  }
  // Route /jobs, /dashboard to the new app
  return href;
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...rest }) => (
            <a href={rewriteHref(href)} {...rest}>
              {children}
            </a>
          ),
          img: ({ src, alt, ...rest }) => (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={src} alt={alt ?? ""} loading="lazy" {...rest} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
