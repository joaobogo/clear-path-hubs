/**
 * CV preview for the review screen.
 *
 * Signed storage URLs are deliberately short-lived, which used to mean a long
 * review ended with a blank iframe. This pane owns the link's lifetime: it
 * re-signs when the reviewer returns to the tab, shortly before expiry, and on
 * demand — and says plainly when the link has lapsed instead of showing nothing.
 */
import { useCallback, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, RefreshCw, ExternalLink, AlertTriangle } from "lucide-react";
import { resignAdminCvUrl } from "@/lib/processing.functions";
import { Button } from "@/components/ui/button";

/** Re-sign this long before expiry so the reviewer never sees a dead frame. */
const REFRESH_MARGIN_MS = 45_000;

export function CvPreviewPane({
  matchId,
  candidateName,
  initialUrl,
  initialExpiresAt,
}: {
  matchId: string;
  candidateName: string;
  initialUrl: string | null;
  initialExpiresAt: string | null;
}) {
  const resign = useServerFn(resignAdminCvUrl);
  const [url, setUrl] = useState(initialUrl);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [expired, setExpired] = useState(false);

  const refresh = useMutation({
    mutationFn: () => resign({ data: { match_id: matchId } }),
    onSuccess: (res) => {
      setUrl(res.signed_url);
      setExpiresAt(res.url_expires_at);
      setExpired(res.signed_url === null);
    },
    onError: () => setExpired(true),
  });

  const hasCv = initialUrl !== null;
  const doRefresh = useCallback(() => {
    if (!hasCv || refresh.isPending) return;
    refresh.mutate();
  }, [hasCv, refresh]);

  // Re-sign when the tab regains focus: the common case is a reviewer who left
  // the screen open while chasing context elsewhere.
  useEffect(() => {
    if (!hasCv) return;
    const onFocus = () => {
      const left = expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0;
      if (left < REFRESH_MARGIN_MS) doRefresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [hasCv, expiresAt, doRefresh]);

  // Pre-emptive refresh while the tab stays open and in use.
  useEffect(() => {
    if (!hasCv || !expiresAt) return;
    const left = new Date(expiresAt).getTime() - Date.now() - REFRESH_MARGIN_MS;
    if (left <= 0) {
      setExpired(true);
      return;
    }
    const t = setTimeout(() => setExpired(true), left);
    return () => clearTimeout(t);
  }, [hasCv, expiresAt]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <FileText className="h-3.5 w-3.5" aria-hidden /> CV
        </h2>
        {hasCv && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              onClick={doRefresh}
              disabled={refresh.isPending}
            >
              <RefreshCw
                className={`h-3 w-3 ${refresh.isPending ? "animate-spin motion-reduce:animate-none" : ""}`}
                aria-hidden
              />
              {refresh.isPending ? "Refreshing…" : "Refresh link"}
            </Button>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open in new tab <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </div>
        )}
      </div>

      {!hasCv ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
          No CV on file for this application.
        </div>
      ) : expired || !url ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle className="h-5 w-5 taas-tx-warning" aria-hidden />
          <p className="max-w-xs text-xs text-muted-foreground">
            The secure preview link has expired. Nothing is wrong with the CV — links
            are short-lived on purpose.
          </p>
          <Button size="sm" variant="outline" onClick={doRefresh} disabled={refresh.isPending}>
            {refresh.isPending ? "Reloading…" : "Reload CV"}
          </Button>
        </div>
      ) : (
        <iframe
          key={url}
          src={`${url}#view=FitH`}
          title={`CV for ${candidateName}`}
          className="min-h-0 w-full flex-1 bg-muted"
        />
      )}
    </section>
  );
}
