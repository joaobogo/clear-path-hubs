import { describe, expect, it } from "vitest";
import {
  HTML_CACHE_CONTROL,
  htmlCacheControlFor,
  PRIVATE_HTML_CACHE_CONTROL,
  isIndexableHost,
  legacyBookingRedirectFor,
} from "@/lib/seo/edge-policy";

describe("legacy booking redirects", () => {
  it("redirects every retired booking path to /contact", () => {
    for (const p of ["/book", "/book-call", "/book-a-call", "/schedule", "/demo", "/demo/", "/Schedule"]) {
      expect(legacyBookingRedirectFor(p)).toBe("/contact");
    }
  });

  it("leaves unrelated paths alone", () => {
    expect(legacyBookingRedirectFor("/contact")).toBeNull();
    expect(legacyBookingRedirectFor("/demo-day")).toBeNull();
  });
});

describe("preview host indexing", () => {
  it("indexes only the production host", () => {
    expect(isIndexableHost("taasflow.com")).toBe(true);
    expect(isIndexableHost("www.taasflow.com")).toBe(true);
    expect(isIndexableHost("taasflow.com:443")).toBe(true);
    expect(isIndexableHost("id-preview--abc.lovable.app")).toBe(false);
    expect(isIndexableHost("clear-path-hubs.lovable.app")).toBe(false);
    expect(isIndexableHost("evil-taasflow.com")).toBe(true); // fails open: unknown hosts are never noindexed
    expect(isIndexableHost("taasflow.com.")).toBe(true);
    expect(isIndexableHost("origin.workers.dev")).toBe(true);
    expect(isIndexableHost("Foo.Lovable.App:8080")).toBe(false);
    expect(isIndexableHost("x.lovableproject.com")).toBe(false);
  });
});

describe("html cache policy", () => {
  const base = {
    pathname: "/pricing",
    status: 200,
    contentType: "text/html; charset=utf-8",
    hasCacheControl: false,
    hasSetCookie: false,
  };
  it("revalidates public HTML", () => {
    expect(htmlCacheControlFor(base)).toBe(HTML_CACHE_CONTROL);
  });
  it("leaves APIs, assets, workspace pages, redirects, and explicit caching alone", () => {
    expect(htmlCacheControlFor({ ...base, pathname: "/api/x" })).toBeNull();
    expect(htmlCacheControlFor({ ...base, pathname: "/login" })).toBe(PRIVATE_HTML_CACHE_CONTROL);
    expect(htmlCacheControlFor({ ...base, pathname: "/assets/a.js" })).toBeNull();
    expect(htmlCacheControlFor({ ...base, pathname: "/admin/candidates" })).toBeNull();
    expect(htmlCacheControlFor({ ...base, pathname: "/client" })).toBeNull();
    expect(htmlCacheControlFor({ ...base, pathname: "/share/abc" })).toBeNull();
    expect(htmlCacheControlFor({ ...base, status: 301 })).toBeNull();
    expect(htmlCacheControlFor({ ...base, hasCacheControl: true })).toBeNull();
    expect(htmlCacheControlFor({ ...base, hasSetCookie: true })).toBeNull();
    expect(htmlCacheControlFor({ ...base, contentType: "application/xml" })).toBeNull();
  });
});
