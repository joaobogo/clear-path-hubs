import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/motion/use-motion";
import { buildField, FIELD_GATES, FIELD_LINES, type FieldLine, type Point } from "@/lib/run/field";

/**
 * ConvergenceField (The Run): a canvas behind the hero. About 1,700
 * hair-thin blue lines enter on one edge, thin at three gates and ten
 * survive, darkening to ink after the last gate and ending on the list rows.
 *
 * Rules from the document:
 *  - never a background texture: it always ends on something (here, the list)
 *  - the one glow on the site: the ten surviving lines
 *  - draws once on load over 2.4 s, lines growing along the flow; counts tick
 *    as the front passes each gate (reported through `onFront`)
 *  - reduced motion, or a device that cannot hold the frame rate, shows the
 *    finished frame
 *  - hidden from assistive technology; the list beside it is real text
 *  - a static image stands in when scripts do not run
 */
export const FIELD_DRAW_MS = 2400;
export const FIELD_REDRAW_MS = 1600;

/** Settle curve, cubic-bezier(.2,.8,.2,1), close enough for a progress value. */
function settle(t: number): number {
  return 1 - Math.pow(1 - t, 2.6);
}

function cssVar(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

type Palette = { faint: string; blue: string; ink: string; glow: string };

function draw(
  ctx: CanvasRenderingContext2D,
  lines: readonly FieldLine[],
  w: number,
  h: number,
  flow: "right" | "down",
  progress: number,
  palette: Palette,
) {
  ctx.clearRect(0, 0, w, h);
  const A = flow === "right" ? w : h;
  const front = A * progress;
  const lastGate = A * FIELD_GATES[2];

  const clipAlong = (from: number, to: number) => {
    ctx.beginPath();
    if (flow === "right") ctx.rect(from, 0, Math.max(0, to - from), h);
    else ctx.rect(0, from, w, Math.max(0, to - from));
    ctx.clip();
  };
  const stroke = (l: FieldLine) => {
    ctx.beginPath();
    ctx.moveTo(l.p0.x, l.p0.y);
    ctx.bezierCurveTo(l.c1.x, l.c1.y, l.c2.x, l.c2.y, l.p1.x, l.p1.y);
    ctx.stroke();
  };

  // Everyone who heard: hair-thin, faint blue, up to the front.
  ctx.save();
  clipAlong(0, front);
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = palette.faint;
  ctx.globalAlpha = flow === "right" ? 0.42 : 0.18;
  for (const l of lines) if (l.passed < 3) stroke(l);

  // The ten: blue until the last gate, then ink, with the site's one glow.
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = palette.blue;
  ctx.save();
  clipAlong(0, Math.min(front, lastGate));
  for (const l of lines) if (l.passed === 3) stroke(l);
  ctx.restore();
  if (front > lastGate) {
    ctx.save();
    clipAlong(lastGate, front);
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 8;
    for (const l of lines) if (l.passed === 3) stroke(l);
    ctx.restore();
  }
  ctx.restore();
}

export function ConvergenceField({
  seed,
  counts,
  getTargets,
  onFront,
  stillSrc,
}: {
  /** The role; the same role always draws the same field. */
  seed: string;
  counts: readonly [number, number, number, number];
  /** The ten list-row anchors, in pixels relative to this element. */
  getTargets: () => Point[];
  /** Progress of the drawing front, 0 to 1, every frame. */
  onFront?: (progress: number) => void;
  /** The static image shown when scripts do not run. */
  stillSrc: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const onFrontRef = useRef(onFront);
  onFrontRef.current = onFront;
  const drawnOnce = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const palette: Palette = {
      faint: cssVar(host, "--blue-300", "#9fbff2"),
      blue: cssVar(host, "--blue-600", "#42669e"),
      ink: cssVar(host, "--ink", "#0f172a"),
      glow: cssVar(host, "--blue-300", "#9fbff2"),
    };

    let lines: FieldLine[] = [];
    let w = 0;
    let h = 0;
    let flow: "right" | "down" = "right";
    let frame = 0;
    let cancelled = false;

    const layout = () => {
      const rect = host.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      flow = w >= 1024 ? "right" : "down";
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // A phone draws a quarter of the crowd, fainter: the field runs top to
      // bottom through the text there, and the text must stay the first thing
      // read.
      lines = buildField({
        width: w,
        height: h,
        targets: getTargets(),
        counts,
        seed,
        flow,
        lines: flow === "right" ? FIELD_LINES : Math.round(FIELD_LINES / 4),
      });
    };

    const finish = () => {
      draw(ctx, lines, w, h, flow, 1, palette);
      onFrontRef.current?.(1);
    };

    const animate = (ms: number) => {
      cancelAnimationFrame(frame);
      const start = performance.now();
      let last = start;
      let slow = 0;
      const tick = (now: number) => {
        if (cancelled) return;
        // A device that cannot hold the frame rate gets the finished frame.
        if (now - last > 50 && ++slow >= 3) {
          finish();
          return;
        }
        last = now;
        const p = settle(Math.min(1, (now - start) / ms));
        draw(ctx, lines, w, h, flow, p, palette);
        onFrontRef.current?.(p);
        if (p < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    layout();
    if (reduced || document.visibilityState === "hidden") {
      finish();
    } else {
      // The first drawing takes the story's time; a new role redraws faster.
      animate(drawnOnce.current ? FIELD_REDRAW_MS : FIELD_DRAW_MS);
    }
    drawnOnce.current = true;

    // A resize re-fits the finished field to the new rows; it never replays.
    const ro = new ResizeObserver(() => {
      if (cancelled) return;
      cancelAnimationFrame(frame);
      layout();
      finish();
    });
    ro.observe(host);

    if (import.meta.env.DEV) {
      // Lets a script capture the finished frame as the static fallback image.
      (window as unknown as { __runFieldStill?: () => string }).__runFieldStill = () => {
        cancelAnimationFrame(frame);
        finish();
        return canvas.toDataURL("image/png");
      };
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [seed, reduced, counts, getTargets]);

  return (
    <div ref={hostRef} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="block" />
      <noscript>
        <img src={stillSrc} alt="" className="absolute inset-0 h-full w-full object-cover object-left-bottom" />
      </noscript>
    </div>
  );
}
