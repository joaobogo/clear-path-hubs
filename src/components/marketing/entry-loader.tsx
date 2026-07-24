import { useEffect, useRef, useState } from "react";

const SESSION_KEY = "taasflow.entryLoader.seen.v1";
const MAX_TIMEOUT_MS = 2500;
const FAST_SKIP_MS = 180;
const EXIT_MS = 380;

const STAGES = ["Role", "Source", "Evaluate", "Rank", "Deliver"] as const;

const MICRO_MESSAGES = [
  "Mapping the role",
  "Activating sourcing channels",
  "Preparing ranked candidates",
  "Opening your hiring workspace",
];

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Full-screen brand loader shown once per browser session on first entry.
 * - Waits only for critical readiness (document + fonts) with a 2.5s cap.
 * - Skips entirely when hydration is already fast (<180ms).
 * - Respects prefers-reduced-motion.
 */
export function TaaSFlowEntryLoader() {
  const [mounted, setMounted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return false;
    } catch {
      /* private mode */
    }
    return true;
  });
  const [exiting, setExiting] = useState(false);
  const [stage, setStage] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const startedAt = useRef<number>(typeof performance !== "undefined" ? performance.now() : Date.now());
  const reduced = useRef<boolean>(false);

  useEffect(() => {
    if (!mounted) return;
    reduced.current = prefersReducedMotion();

    let cancelled = false;
    const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      // Fast-connection: skip loader flash entirely
      if (now() - startedAt.current < FAST_SKIP_MS) {
        try {
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch { /* noop */ }
        setMounted(false);
        return;
      }
      setStage(STAGES.length - 1);
      setExiting(true);
      window.setTimeout(() => {
        try {
          sessionStorage.setItem(SESSION_KEY, "1");
        } catch { /* noop */ }
        setMounted(false);
      }, EXIT_MS);
    };

    // Readiness signals
    const fontsReady =
      typeof document !== "undefined" && "fonts" in document
        ? (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready
        : Promise.resolve();

    const domReady = new Promise<void>((resolve) => {
      if (typeof document === "undefined" || document.readyState === "complete") return resolve();
      const on = () => resolve();
      window.addEventListener("load", on, { once: true });
    });

    const raf2 = new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const critical = Promise.all([fontsReady, domReady, raf2]).then(() => {
      // small guaranteed reveal so brand moment lands (unless reduced motion)
      const min = reduced.current ? 0 : 550;
      const elapsed = now() - startedAt.current;
      return new Promise<void>((res) => window.setTimeout(res, Math.max(0, min - elapsed)));
    });

    const timeoutId = window.setTimeout(finish, MAX_TIMEOUT_MS);
    critical.then(() => {
      window.clearTimeout(timeoutId);
      finish();
    });

    // Stage progression (indeterminate; not tied to real progress)
    const stageInterval = window.setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 2));
    }, reduced.current ? 999999 : 320);

    const msgInterval = window.setInterval(() => {
      setMsgIdx((i) => (i + 1) % MICRO_MESSAGES.length);
    }, reduced.current ? 999999 : 900);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.clearInterval(stageInterval);
      window.clearInterval(msgInterval);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="TaaSFlow is starting"
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(1200px 800px at 50% 30%, #12244a 0%, #0a1533 45%, #050c22 100%)",
        opacity: exiting ? 0 : 1,
        transition: `opacity ${EXIT_MS}ms ease-out`,
        pointerEvents: exiting ? "none" : "auto",
      }}
    >
      {/* subtle animated light sweep */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-40 motion-reduce:hidden"
        style={{
          background:
            "conic-gradient(from 220deg at 50% 50%, transparent 0deg, rgba(96,165,250,0.18) 60deg, transparent 140deg)",
          animation: "tf-sweep 6s linear infinite",
        }}
      />

      <div className="relative flex flex-col items-center gap-8 px-6 text-center">
        {/* Logo mark + wordmark */}
        <div
          className="flex items-center gap-3"
          style={{
            transform: exiting ? "scale(0.96)" : "scale(1)",
            transition: `transform ${EXIT_MS}ms ease-out`,
          }}
        >
          <svg
            width="52"
            height="52"
            viewBox="0 0 52 52"
            fill="none"
            aria-hidden
            className="drop-shadow-[0_0_24px_rgba(96,165,250,0.35)]"
          >
            <defs>
              <linearGradient id="tf-g" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="50" height="50" rx="12" stroke="url(#tf-g)" strokeWidth="1.5" />
            <path
              d="M12 18 H40 M26 18 V38"
              stroke="url(#tf-g)"
              strokeWidth="3"
              strokeLinecap="round"
              className="motion-reduce:hidden"
              style={{
                strokeDasharray: 80,
                strokeDashoffset: 80,
                animation: "tf-draw 1.1s cubic-bezier(.6,.2,.2,1) 0.05s forwards",
              }}
            />
            <path
              d="M12 18 H40 M26 18 V38"
              stroke="url(#tf-g)"
              strokeWidth="3"
              strokeLinecap="round"
              className="hidden motion-reduce:block"
            />
          </svg>
          <span
            className="text-3xl font-semibold tracking-tight text-white"
            style={{
              fontFamily: "Fraunces, ui-serif, Georgia, serif",
              opacity: 0,
              animation: "tf-fade-up 700ms ease-out 0.45s forwards",
            }}
          >
            TaaSFlow
          </span>
        </div>

        {/* Hiring-flow indicator */}
        <div
          className="flex items-center gap-2 sm:gap-3"
          style={{
            opacity: 0,
            animation: "tf-fade-up 700ms ease-out 0.75s forwards",
          }}
        >
          {STAGES.map((label, i) => {
            const active = i <= stage;
            return (
              <div key={label} className="flex items-center gap-2 sm:gap-3">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: active ? "#60a5fa" : "rgba(148,163,184,0.35)",
                      boxShadow: active ? "0 0 12px rgba(96,165,250,0.7)" : "none",
                      transition: "background 300ms, box-shadow 300ms",
                    }}
                  />
                  <span
                    className="text-[10px] uppercase tracking-[0.14em] sm:text-xs"
                    style={{ color: active ? "#dbeafe" : "rgba(148,163,184,0.7)" }}
                  >
                    {label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div
                    className="h-px w-6 sm:w-10"
                    style={{
                      background: active
                        ? "linear-gradient(90deg,#60a5fa,rgba(96,165,250,0.2))"
                        : "rgba(148,163,184,0.2)",
                      marginBottom: 18,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Supporting line */}
        <p
          className="text-sm text-slate-300 sm:text-base"
          style={{
            opacity: 0,
            animation: "tf-fade-up 700ms ease-out 1s forwards",
            minHeight: 20,
          }}
        >
          <span className="sr-only">Loading TaaSFlow. </span>
          <span aria-hidden className="motion-reduce:hidden">{MICRO_MESSAGES[msgIdx]}…</span>
          <span aria-hidden className="hidden motion-reduce:inline">
            Your hiring engine is starting.
          </span>
        </p>
      </div>

      <style>{`
        @keyframes tf-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes tf-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes tf-fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] * { animation: none !important; transition: opacity 200ms linear !important; }
        }
      `}</style>
    </div>
  );
}
