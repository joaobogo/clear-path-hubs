/**
 * Inline Calendly widget.
 *
 * Loads Calendly's widget assets on the client only (never at module scope, so
 * SSR stays clean), renders the inline scheduler, and reports the scheduled
 * meeting back to the caller so the app can confirm it and move the person on.
 *
 * The widget is the visitor's view; the signed Calendly webhook remains the
 * authority for times, host and join link.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  CALENDLY_WIDGET_SCRIPT,
  CALENDLY_WIDGET_STYLES,
  calendlyEmbedUrl,
  type CalendlyPrefill,
} from "@/config/calendly";

export type CalendlyScheduledEvent = {
  eventUri: string | null;
  inviteeUri: string | null;
};

type Props = {
  /** Base Calendly event URL. */
  url: string;
  prefill?: CalendlyPrefill;
  /** Fires once the invitee has confirmed a time. */
  onScheduled?: (event: CalendlyScheduledEvent) => void;
  height?: number;
  className?: string;
};

function ensureAssets(): Promise<void> {
  if (!document.querySelector(`link[href="${CALENDLY_WIDGET_STYLES}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CALENDLY_WIDGET_STYLES;
    document.head.appendChild(link);
  }
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${CALENDLY_WIDGET_SCRIPT}"]`,
  );
  if (existing) {
    if (existing.dataset["loaded"] === "true") return Promise.resolve();
    return new Promise((resolve) => existing.addEventListener("load", () => resolve(), { once: true }));
  }
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = CALENDLY_WIDGET_SCRIPT;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset["loaded"] = "true";
      resolve();
    });
    document.head.appendChild(script);
  });
}

function uriOf(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const uri = (value as { uri?: unknown }).uri;
  return typeof uri === "string" && uri.length > 0 ? uri.slice(0, 500) : null;
}

export function CalendlyInline({ url, prefill, onScheduled, height = 660, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const scheduledRef = useRef(false);
  const callbackRef = useRef(onScheduled);
  callbackRef.current = onScheduled;

  const embedUrl = calendlyEmbedUrl(url, prefill);

  useEffect(() => {
    let cancelled = false;
    void ensureAssets().then(() => {
      if (cancelled || !hostRef.current) return;
      const api = (window as unknown as { Calendly?: { initInlineWidget: (o: unknown) => void } })
        .Calendly;
      hostRef.current.innerHTML = "";
      api?.initInlineWidget({ url: embedUrl, parentElement: hostRef.current });
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [embedUrl]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (typeof event.origin === "string" && !event.origin.endsWith("calendly.com")) return;
      const data = event.data as { event?: string; payload?: Record<string, unknown> } | null;
      if (!data || data.event !== "calendly.event_scheduled" || scheduledRef.current) return;
      scheduledRef.current = true;
      callbackRef.current?.({
        eventUri: uriOf(data.payload?.["event"]),
        inviteeUri: uriOf(data.payload?.["invitee"]),
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className={className}>
      {!ready && (
        <div
          className="flex items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground"
          style={{ height }}
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading available times…
        </div>
      )}
      <div ref={hostRef} style={{ minWidth: 320, height: ready ? height : 0 }} aria-live="polite" />
    </div>
  );
}
