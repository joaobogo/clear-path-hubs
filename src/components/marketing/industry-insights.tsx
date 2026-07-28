import { Link } from "@tanstack/react-router";
import { PublicPage, PublicSection } from "@/components/marketing/site-shell";
import { listIndustryBlogPosts } from "@/lib/marketing/industry-blog";

export function IndustryInsights({
  industrySlug,
  industryName,
}: {
  industrySlug: string;
  industryName: string;
}) {
  const posts = listIndustryBlogPosts(industrySlug);
  if (posts.length === 0) return null;

  return (
    <PublicSection className="py-12">
      <PublicPage>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
              Insights
            </p>
            <h2 className="mt-2 font-[family-name:var(--brand-font-display)] text-3xl font-semibold tracking-tight">
              {industryName} hiring intelligence
            </h2>
            <p className="mt-2 max-w-2xl text-[color:var(--brand-navy)]/80">
              Benchmarks, role playbooks and workforce outlook — written for {industryName}{" "}
              talent leaders.
            </p>
          </div>
          <Link
            to="/blog"
            className="text-sm font-semibold text-[color:var(--brand-navy)] underline underline-offset-4 hover:opacity-80"
          >
            All articles →
          </Link>
        </div>

        <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <li
              key={p.slug}
              className="group overflow-hidden rounded-2xl border border-[color:var(--brand-navy)]/10 bg-card transition hover:border-[color:var(--brand-navy)]/30 hover:shadow-sm"
            >
              <Link
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="flex h-full flex-col"
              >
                {p.heroImage ? (
                  <div className="aspect-[16/9] overflow-hidden bg-[color:var(--brand-mist)]/40">
                    <img
                      src={p.heroImage}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-gradient-to-br from-[color:var(--brand-navy)] to-[color:var(--brand-navy)]/60" />
                )}
                <div className="flex flex-1 flex-col p-5">
                  {p.category && (
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-navy)]/80">
                      {p.category}
                    </p>
                  )}
                  <h3 className="mt-2 text-base font-semibold leading-snug tracking-tight text-[color:var(--brand-navy)] group-hover:opacity-90">
                    {p.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm text-[color:var(--brand-navy)]/80">
                    {p.description}
                  </p>
                  <p className="mt-4 text-xs text-[color:var(--brand-navy)]/80">
                    {p.readMinutes} min read
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </PublicPage>
    </PublicSection>
  );
}
