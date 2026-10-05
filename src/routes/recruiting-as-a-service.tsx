import { createFileRoute } from "@tanstack/react-router";
import { SeoMoneyPage } from "@/components/marketing/seo-money-page";
import { MONEY_PAGES } from "@/content/seo-money-pages";
import { faqScript, marketingHead, serviceScript } from "@/lib/marketing/head";

const page = MONEY_PAGES["recruiting-as-a-service"];

export const Route = createFileRoute("/recruiting-as-a-service")({
  head: () => marketingHead(undefined, page.path, {
    title: page.title,
    description: page.description,
  }, {
    breadcrumbs: [{ name: "Home", path: "/" }, { name: page.eyebrow, path: page.path }],
    scripts: [
      serviceScript({ name: page.h1, description: page.directAnswer, path: page.path, serviceType: "Recruiting" }),
      faqScript(page.faqs),
    ],
  }),
  component: () => <SeoMoneyPage page={page} />,
});
