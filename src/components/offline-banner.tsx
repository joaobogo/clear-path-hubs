import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff, Wifi } from "lucide-react";
import { useOnline } from "@/hooks/use-online";

/**
 * App-wide connectivity banner. Explains the loss in human language, keeps the
 * page's last safe data visible underneath, and confirms recovery once the
 * connection returns (retry-succeeded state).
 */
export function OfflineBanner() {
  const online = useOnline();
  const queryClient = useQueryClient();
  const wasOffline = useRef(false);
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setRecovered(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setRecovered(true);
    // Refetching on reconnect is a read-only recovery: mutations never
    // auto-replay, so a retry can't create duplicates.
    queryClient.invalidateQueries();
    const t = setTimeout(() => setRecovered(false), 4000);
    return () => clearTimeout(t);
  }, [online, queryClient]);

  if (online && !recovered) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4"
    >
      <div
        className={
          online
            ? "flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-foreground shadow-lg backdrop-blur"
            : "flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm text-foreground shadow-lg backdrop-blur"
        }
      >
        {online ? (
          <>
            <Wifi className="h-4 w-4" aria-hidden />
            Back online — refreshed with the latest.
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" aria-hidden />
            You're offline. What's on screen is the last version we loaded, and nothing you
            do now will be saved until you reconnect.
          </>
        )}
      </div>
    </div>
  );
}
