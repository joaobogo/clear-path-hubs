/**
 * Brand Center — exact-dimension asset templates.
 *
 * Three visual systems, one brand:
 *   A · Outcome-led editorial — strong type, whitespace, single focal statement.
 *   B · Operating diagram — the hiring pipeline drawn as structure and evidence.
 *   C · Human context — dark editorial plate with disciplined overlay bands.
 *
 * All three share the same logo rules, type scale, palette, grid and tone.
 */

import { C } from "./palette";
import type { Scene, SceneNode } from "./scene";
import { IDENTITY } from "./messaging";
import logoOnWhite from "@/assets/brand/logo-on-white.png";
import logoOnBlue from "@/assets/brand/logo-on-blue.png";
import iconWhite from "@/assets/brand/icon-white.png";

export const LOGO = { light: logoOnWhite, dark: logoOnBlue, icon: iconWhite };
/** Master wordmark aspect ratio (1695 x 408). */
const LOGO_RATIO = 1695 / 408;

export type VisualSystem = "A" | "B" | "C";

export const VISUAL_SYSTEMS: { id: VisualSystem; name: string; description: string }[] = [
  { id: "A", name: "Outcome-led editorial", description: "One statement, generous whitespace, a single quiet accent. Used where the message carries the layout." },
  { id: "B", name: "Operating diagram", description: "The hiring pipeline drawn as labelled stages, routes and evidence nodes. Used to explain how the product works." },
  { id: "C", name: "Human context", description: "Deep navy plate, restrained overlay bands and a clear focal statement. Used for announcements and events." },
];

/* ---------------------------------------------------------------- *
 * Primitives
 * ---------------------------------------------------------------- */

/** Wordmark sized by height, anchored top-left. */
function wordmark(x: number, y: number, h: number, onDark: boolean): SceneNode {
  return { t: "image", href: onDark ? LOGO.dark : LOGO.light, x, y, w: h * LOGO_RATIO, h };
}

function eyebrow(x: number, y: number, text: string, fill: string, size = 13): SceneNode {
  return { t: "text", x, y, text, size, weight: 600, fill, font: "sans", tracking: size * 0.12, uppercase: true };
}

function lines(
  x: number, y: number, rows: string[], size: number, lead: number,
  fill: string, weight = 600, font: "display" | "sans" = "display",
  anchor: "start" | "middle" = "start",
): SceneNode[] {
  return rows.map((text, i) => ({
    t: "text", x, y: y + i * lead, text, size, weight, fill, font, anchor,
    tracking: font === "display" ? -size * 0.02 : -size * 0.005,
  }));
}

function chip(x: number, y: number, w: number, h: number, label: string, fill: string, textFill: string, size = 15): SceneNode[] {
  return [
    { t: "rect", x, y, w, h, rx: h / 2, fill },
    { t: "text", x: x + w / 2, y: y + h / 2 + size * 0.35, text: label, size, weight: 600, fill: textFill, anchor: "middle", font: "sans" },
  ];
}

/** System B motif: intake → sourcing → evidence → shortlist. */
function pipeline(
  x: number, y: number, w: number, opts: { onDark: boolean; scale?: number; labels?: boolean },
): SceneNode[] {
  const s = opts.scale ?? 1;
  const stages = ["Intake", "Sourcing", "Evidence", "Shortlist"];
  const gap = w / (stages.length - 1);
  const line = opts.onDark ? C.navyLight : C.skyDark;
  const dot = opts.onDark ? C.oceanLight : C.ocean;
  const label = opts.onDark ? C.sky : C.slate;
  const nodes: SceneNode[] = [
    { t: "line", x1: x, y1: y, x2: x + w, y2: y, stroke: line, sw: 2 * s },
  ];
  stages.forEach((stage, i) => {
    const cx = x + gap * i;
    const filled = i < stages.length - 1;
    nodes.push({ t: "circle", cx, cy: y, r: 9 * s, fill: filled ? dot : C.success });
    if (filled) nodes.push({ t: "circle", cx, cy: y, r: 16 * s, fill: dot, opacity: 0.16 });
    if (opts.labels !== false) {
      nodes.push({
        t: "text", x: cx, y: y + 34 * s, text: stage, size: 15 * s, weight: 600,
        fill: label, anchor: "middle", font: "sans", tracking: 0.4 * s,
      });
    }
  });
  return nodes;
}

/** System B secondary motif: stacked evidence rows behind a ranked candidate. */
function evidenceStack(x: number, y: number, w: number, onDark: boolean, rows = 4): SceneNode[] {
  const nodes: SceneNode[] = [];
  const rowH = 18;
  const gap = 12;
  for (let i = 0; i < rows; i++) {
    const width = w * (1 - i * 0.13);
    nodes.push({
      t: "rect", x, y: y + i * (rowH + gap), w: width, h: rowH, rx: 5,
      fill: onDark ? C.oceanLight : C.ocean, opacity: 0.9 - i * 0.18,
    });
    nodes.push({
      t: "rect", x: x + width + 12, y: y + i * (rowH + gap) + 3, w: 46, h: rowH - 6, rx: 4,
      fill: onDark ? C.navy : C.sky,
    });
  }
  return nodes;
}

/** Corner rule used across System A. */
function rule(x: number, y: number, w: number, fill: string): SceneNode {
  return { t: "rect", x, y, w, h: 4, rx: 2, fill };
}

const guideBox = (x: number, y: number, w: number, h: number, label: string): SceneNode[] => [
  { t: "rect", x, y, w, h, stroke: C.danger, sw: 2, fill: "none", opacity: 0.9 },
  { t: "text", x: x + 12, y: y + 26, text: label, size: 16, weight: 600, fill: C.danger, font: "sans" },
];

/* ---------------------------------------------------------------- *
 * LinkedIn company header — 1128 x 191, three distinct concepts
 * ---------------------------------------------------------------- */

export const linkedinCompanyOutcome = (): Scene => ({
  width: 1128, height: 191, background: C.paper,
  nodes: [
    { t: "rect", x: 0, y: 0, w: 6, h: 191, fill: C.ocean },
    wordmark(48, 48, 34, false),
    { t: "text", x: 48, y: 132, text: IDENTITY.promise, size: 27, weight: 600, fill: C.navy, font: "display", tracking: -0.6 },
    { t: "text", x: 48, y: 160, text: IDENTITY.tagline, size: 15, weight: 500, fill: C.slate, font: "sans" },
    { t: "rect", x: 700, y: 0, w: 428, h: 191, fill: C.sky, opacity: 0.55 },
    ...pipeline(748, 86, 330, { onDark: false }),
  ],
  guides: guideBox(24, 16, 1080, 159, "Safe margin"),
});

export const linkedinCompanyOperating = (): Scene => ({
  width: 1128, height: 191, background: C.navyDark,
  nodes: [
    ...lines(564, 74, ["One subscription. The whole hiring stack."], 30, 0, C.white, 600, "display", "middle"),
    ...pipeline(264, 128, 600, { onDark: true }),
    wordmark(48, 22, 24, true),
    eyebrow(1080, 38, "Since intake", C.navyLight, 11),
  ],
  guides: guideBox(24, 16, 1080, 159, "Safe margin"),
});

export const linkedinCompanyFgv = (): Scene => ({
  width: 1128, height: 191, background: C.paper,
  nodes: [
    wordmark(48, 44, 30, false),
    { t: "text", x: 48, y: 128, text: "Recruiting, outreach and the ATS in one subscription.", size: 22, weight: 600, fill: C.navy, font: "display", tracking: -0.4 },
    { t: "line", x1: 48, y1: 150, x2: 120, y2: 150, stroke: C.ocean, sw: 3 },
    { t: "text", x: 48, y: 172, text: IDENTITY.parentLine, size: 13, weight: 600, fill: C.slate, font: "sans", tracking: 1.4, uppercase: true },
    ...evidenceStack(830, 42, 200, false, 3),
  ],
  guides: guideBox(24, 16, 1080, 159, "Safe margin"),
});

/* ---------------------------------------------------------------- *
 * LinkedIn personal banner — 1584 x 396, three concepts
 * Profile photo overlaps roughly the lower-left 260 x 260.
 * ---------------------------------------------------------------- */

const personalPhotoGuide = guideBox(56, 176, 264, 220, "Profile photo overlap");

export const linkedinPersonalExecutive = (): Scene => ({
  width: 1584, height: 396, background: C.paper,
  nodes: [
    { t: "rect", x: 0, y: 0, w: 1584, h: 396, fill: C.paper },
    { t: "rect", x: 520, y: 0, w: 1064, h: 396, fill: C.sky, opacity: 0.5 },
    wordmark(72, 60, 34, false),
    ...lines(600, 168, ["Hiring shouldn't cost", "a percentage of the hire."], 44, 58, C.navy, 600, "display"),
    { t: "text", x: 600, y: 286, text: IDENTITY.tagline, size: 20, weight: 500, fill: C.slate, font: "sans" },
    rule(600, 312, 96, C.ocean),
  ],
  guides: [...personalPhotoGuide, ...guideBox(40, 24, 1504, 348, "Safe margin")],
});

export const linkedinPersonalSystem = (): Scene => ({
  width: 1584, height: 396, background: C.navyDark,
  nodes: [
    wordmark(72, 56, 30, true),
    eyebrow(72, 132, "How a role runs", C.oceanLight, 14),
    ...pipeline(560, 198, 880, { onDark: true }),
    { t: "text", x: 1000, y: 300, text: "Every shortlist arrives ranked, with the evidence attached.", size: 20, weight: 500, fill: C.sky, anchor: "middle", font: "sans" },
  ],
  guides: [...personalPhotoGuide, ...guideBox(40, 24, 1504, 348, "Safe margin")],
});

export const linkedinPersonalEcosystem = (): Scene => ({
  width: 1584, height: 396, background: C.paper,
  nodes: [
    { t: "rect", x: 0, y: 0, w: 1584, h: 10, fill: C.ocean },
    wordmark(72, 66, 32, false),
    ...lines(560, 176, ["Your whole hiring stack,", "all in one."], 46, 60, C.navy, 600, "display"),
    { t: "text", x: 560, y: 292, text: IDENTITY.parentLine, size: 15, weight: 600, fill: C.slate, font: "sans", tracking: 1.6, uppercase: true },
    ...evidenceStack(1240, 132, 240, false, 4),
  ],
  guides: [...personalPhotoGuide, ...guideBox(40, 24, 1504, 348, "Safe margin")],
});

/* ---------------------------------------------------------------- *
 * Profile images, other networks
 * ---------------------------------------------------------------- */

export const profileImageDark = (): Scene => ({
  width: 400, height: 400, background: C.navyDark,
  nodes: [{ t: "image", href: LOGO.icon, x: 96, y: 96, w: 208, h: 208 }],
  guides: [{ t: "circle", cx: 200, cy: 200, r: 200, stroke: C.danger, sw: 3, fill: "none" }],
});

export const profileImageLight = (): Scene => ({
  width: 400, height: 400, background: C.paper,
  nodes: [
    { t: "circle", cx: 200, cy: 200, r: 152, fill: C.ocean },
    { t: "image", href: LOGO.icon, x: 116, y: 116, w: 168, h: 168 },
  ],
  guides: [{ t: "circle", cx: 200, cy: 200, r: 200, stroke: C.danger, sw: 3, fill: "none" }],
});

export const xHeader = (): Scene => ({
  width: 1500, height: 500, background: C.navyDark,
  nodes: [
    { t: "rect", x: 0, y: 0, w: 1500, h: 500, fill: C.navyDark },
    { t: "rect", x: 0, y: 420, w: 1500, h: 6, fill: C.ocean, opacity: 0.6 },
    wordmark(560, 96, 40, true),
    ...lines(560, 220, ["Your whole hiring stack,", "all in one."], 54, 68, C.white, 600, "display"),
    { t: "text", x: 560, y: 330, text: IDENTITY.tagline, size: 22, weight: 500, fill: C.oceanLight, font: "sans" },
  ],
  guides: guideBox(0, 60, 400, 380, "Profile photo / left overlap"),
});

export const facebookCover = (): Scene => ({
  width: 820, height: 312, background: C.paper,
  nodes: [
    { t: "rect", x: 0, y: 0, w: 820, h: 312, fill: C.paper },
    wordmark(410 - (28 * LOGO_RATIO) / 2, 52, 28, false),
    ...lines(410, 154, ["Your whole hiring stack, all in one."], 28, 0, C.navy, 600, "display", "middle"),
    ...pipeline(230, 218, 360, { onDark: false }),
  ],
  guides: guideBox(90, 24, 640, 264, "Mobile-safe centre"),
});

export const youtubeArt = (): Scene => ({
  width: 2560, height: 1440, background: C.navyDark,
  nodes: [
    { t: "rect", x: 0, y: 0, w: 2560, h: 1440, fill: C.navyDark },
    { t: "rect", x: 507, y: 508, w: 1546, h: 423, fill: C.navy, opacity: 0.45 },
    wordmark(1280 - (54 * LOGO_RATIO) / 2, 566, 54, true),
    ...lines(1280, 738, ["Your whole hiring stack, all in one."], 56, 0, C.white, 600, "display", "middle"),
    { t: "text", x: 1280, y: 800, text: IDENTITY.tagline, size: 28, weight: 500, fill: C.oceanLight, anchor: "middle", font: "sans" },
    ...pipeline(940, 880, 680, { onDark: true, labels: false }),
  ],
  guides: guideBox(507, 508, 1546, 423, "TV / mobile safe area 1546 x 423"),
});

export const ogImage = (): Scene => ({
  width: 1200, height: 630, background: C.paper,
  nodes: [
    { t: "rect", x: 0, y: 0, w: 1200, h: 630, fill: C.paper },
    { t: "rect", x: 0, y: 0, w: 1200, h: 12, fill: C.ocean },
    wordmark(80, 84, 44, false),
    ...lines(80, 268, ["Your whole hiring stack,", "all in one."], 62, 78, C.navy, 600, "display"),
    { t: "text", x: 80, y: 400, text: IDENTITY.tagline, size: 28, weight: 500, fill: C.slate, font: "sans" },
    ...pipeline(80, 490, 620, { onDark: false }),
    { t: "text", x: 1120, y: 566, text: "taasflow.com", size: 22, weight: 600, fill: C.oceanText, anchor: "end", font: "sans" },
  ],
});

/* ---------------------------------------------------------------- *
 * Instagram square 1080 x 1080
 * ---------------------------------------------------------------- */

export const igInsight = (): Scene => ({
  width: 1080, height: 1080, background: C.paper,
  nodes: [
    wordmark(88, 88, 40, false),
    eyebrow(88, 250, "Hiring notes", C.oceanText, 20),
    ...lines(88, 372, ["A shortlist without", "evidence is just", "a shorter pile."], 76, 96, C.navy, 600, "display"),
    rule(88, 700, 120, C.ocean),
    { t: "text", x: 88, y: 776, text: "Every TaaSFlow shortlist ships ranked, with the", size: 28, weight: 400, fill: C.slate, font: "sans" },
    { t: "text", x: 88, y: 818, text: "evidence behind each ranking attached.", size: 28, weight: 400, fill: C.slate, font: "sans" },
    ...evidenceStack(88, 890, 500, false, 3),
  ],
});

export const igCarouselCover = (): Scene => ({
  width: 1080, height: 1080, background: C.navyDark,
  nodes: [
    wordmark(88, 88, 38, true),
    eyebrow(88, 250, "Carousel · 5 slides", C.oceanLight, 20),
    ...lines(88, 384, ["What a", "recruiting", "subscription", "actually covers."], 80, 100, C.white, 600, "display"),
    ...pipeline(88, 860, 700, { onDark: true }),
    { t: "text", x: 992, y: 1006, text: "Swipe →", size: 26, weight: 600, fill: C.oceanLight, anchor: "end", font: "sans" },
  ],
});

export const igAnnouncement = (): Scene => ({
  width: 1080, height: 1080, background: C.paper,
  nodes: [
    { t: "rect", x: 0, y: 0, w: 1080, h: 420, fill: C.navyDark },
    wordmark(88, 96, 38, true),
    ...chip(88, 208, 236, 52, "Announcement", C.ocean, C.white, 22),
    ...lines(88, 560, ["We're hiring for", "our own team."], 68, 88, C.navy, 600, "display"),
    { t: "text", x: 88, y: 720, text: "Open roles, the process, and what we look for —", size: 28, weight: 400, fill: C.slate, font: "sans" },
    { t: "text", x: 88, y: 762, text: "all listed on the TaaSFlow job board.", size: 28, weight: 400, fill: C.slate, font: "sans" },
    ...chip(88, 848, 300, 72, "See open roles", C.ocean, C.white, 26),
    { t: "text", x: 88, y: 1000, text: "taasflow.com/jobs", size: 24, weight: 600, fill: C.oceanText, font: "sans" },
  ],
});

/* ---------------------------------------------------------------- *
 * Instagram portrait 1080 x 1350
 * ---------------------------------------------------------------- */

export const igFramework = (): Scene => ({
  width: 1080, height: 1350, background: C.paper,
  nodes: [
    wordmark(88, 88, 38, false),
    eyebrow(88, 232, "How a role runs", C.oceanText, 20),
    ...lines(88, 330, ["Four stages,", "one workspace."], 66, 84, C.navy, 600, "display"),
    ...[0, 1, 2, 3].map<SceneNode>((i) => ({
      t: "rect", x: 88, y: 520 + i * 176, w: 904, h: 148, rx: 20, fill: C.sky, opacity: 0.6,
    })),
    ...["Intake", "Sourcing", "Evidence", "Shortlist"].flatMap<SceneNode>((label, i) => [
      { t: "circle", cx: 156, cy: 594 + i * 176, r: 26, fill: C.ocean },
      { t: "text", x: 156, y: 604 + i * 176, text: String(i + 1), size: 26, weight: 700, fill: C.white, anchor: "middle", font: "sans" },
      { t: "text", x: 212, y: 578 + i * 176, text: label, size: 34, weight: 600, fill: C.navy, font: "display" },
      {
        t: "text", x: 212, y: 622 + i * 176, size: 24, weight: 400, fill: C.slate, font: "sans",
        text: [
          "Define the role and what good looks like.",
          "Recruiters run continuous outreach.",
          "Each candidate reviewed against the criteria.",
          "Ranked list, evidence attached.",
        ][i],
      },
    ]),
  ],
});

export const igService = (): Scene => ({
  width: 1080, height: 1350, background: C.navyDark,
  nodes: [
    wordmark(88, 88, 38, true),
    eyebrow(88, 246, "What's included", C.oceanLight, 20),
    ...lines(88, 356, ["ATS, recruiting", "and outreach —", "one price."], 70, 88, C.white, 600, "display"),
    ...["Hiring workspace and pipeline", "Ongoing sourcing and outreach", "Evidence-based candidate review", "Ranked shortlists with sources"].flatMap<SceneNode>((label, i) => [
      { t: "circle", cx: 110, cy: 706 + i * 108, r: 12, fill: C.oceanLight },
      { t: "text", x: 152, y: 718 + i * 108, text: label, size: 32, weight: 500, fill: C.sky, font: "sans" },
    ]),
    { t: "line", x1: 88, y1: 1148, x2: 992, y2: 1148, stroke: C.navy, sw: 2 },
    { t: "text", x: 88, y: 1218, text: "Start with a paid pilot on one role.", size: 30, weight: 600, fill: C.white, font: "display" },
    { t: "text", x: 88, y: 1264, text: "taasflow.com/pilot", size: 24, weight: 600, fill: C.oceanLight, font: "sans" },
  ],
});

export const igEditorial = (): Scene => ({
  width: 1080, height: 1350, background: C.paper,
  nodes: [
    { t: "rect", x: 0, y: 0, w: 1080, h: 560, fill: C.sky, opacity: 0.55 },
    wordmark(88, 88, 38, false),
    ...evidenceStack(88, 268, 620, false, 4),
    eyebrow(88, 668, "Editorial", C.oceanText, 20),
    ...lines(88, 786, ["Screening is", "reading, not", "keyword matching."], 68, 88, C.navy, 600, "display"),
    { t: "text", x: 88, y: 1096, text: "Candidates are reviewed against the role's own criteria,", size: 27, weight: 400, fill: C.slate, font: "sans" },
    { t: "text", x: 88, y: 1136, text: "and the evidence travels with the ranking.", size: 27, weight: 400, fill: C.slate, font: "sans" },
    rule(88, 1216, 120, C.ocean),
  ],
});

/* ---------------------------------------------------------------- *
 * Instagram story 1080 x 1920 (top 250 / bottom 250 kept clear)
 * ---------------------------------------------------------------- */

const storyGuides = [
  ...guideBox(0, 0, 1080, 250, "Top UI safe zone"),
  ...guideBox(0, 1670, 1080, 250, "Bottom UI safe zone"),
];

export const storyAnnouncement = (): Scene => ({
  width: 1080, height: 1920, background: C.navyDark,
  nodes: [
    wordmark(88, 300, 40, true),
    ...chip(88, 420, 250, 60, "Announcement", C.ocean, C.white, 24),
    ...lines(88, 700, ["Post a role.", "Get a ranked", "shortlist back."], 84, 108, C.white, 600, "display"),
    ...pipeline(88, 1120, 700, { onDark: true }),
    { t: "text", x: 88, y: 1360, text: "One subscription covers the workspace,", size: 30, weight: 400, fill: C.sky, font: "sans" },
    { t: "text", x: 88, y: 1404, text: "the sourcing and the outreach.", size: 30, weight: 400, fill: C.sky, font: "sans" },
    ...chip(88, 1490, 340, 84, "taasflow.com", C.ocean, C.white, 28),
  ],
  guides: storyGuides,
});

export const storyQuestion = (): Scene => ({
  width: 1080, height: 1920, background: C.paper,
  nodes: [
    wordmark(88, 300, 40, false),
    eyebrow(88, 430, "Question of the week", C.oceanText, 22),
    ...lines(88, 620, ["How long does", "your average", "hire take?"], 84, 108, C.navy, 600, "display"),
    { t: "rect", x: 88, y: 1000, w: 904, h: 300, rx: 28, fill: C.sky, opacity: 0.5 },
    { t: "text", x: 540, y: 1160, text: "Sticker area — place the poll here", size: 30, weight: 500, fill: C.slate, anchor: "middle", font: "sans" },
    { t: "text", x: 88, y: 1440, text: "Tell us and we'll share the range next week.", size: 30, weight: 400, fill: C.slate, font: "sans" },
    rule(88, 1500, 120, C.ocean),
  ],
  guides: storyGuides,
});

export const storyEventReminder = (): Scene => ({
  width: 1080, height: 1920, background: C.navyDark,
  nodes: [
    { t: "rect", x: 0, y: 640, w: 1080, h: 640, fill: C.navy, opacity: 0.55 },
    wordmark(88, 300, 40, true),
    ...chip(88, 430, 210, 60, "Reminder", C.warning, C.ink, 24),
    ...lines(88, 780, ["Live session:", "running a role", "end to end."], 78, 100, C.white, 600, "display"),
    { t: "text", x: 88, y: 1180, text: "Add the date and time here before publishing.", size: 28, weight: 400, fill: C.oceanLight, font: "sans" },
    { t: "text", x: 88, y: 1400, text: "Editable field — do not publish with this line in place.", size: 26, weight: 400, fill: C.sky, font: "sans", opacity: 0.75 },
    ...chip(88, 1480, 340, 84, "taasflow.com", C.ocean, C.white, 28),
  ],
  guides: storyGuides,
});

/* ---------------------------------------------------------------- *
 * Campaign and communication templates
 * ---------------------------------------------------------------- */

export const webinarPromo = (): Scene => ({
  width: 1200, height: 675, background: C.paper,
  nodes: [
    { t: "rect", x: 0, y: 0, w: 420, h: 675, fill: C.navyDark },
    wordmark(48, 56, 30, true),
    eyebrow(48, 200, "Live session", C.oceanLight, 15),
    { t: "text", x: 48, y: 268, text: "Date and time", size: 26, weight: 600, fill: C.white, font: "display" },
    { t: "text", x: 48, y: 306, text: "Editable field", size: 18, weight: 400, fill: C.sky, font: "sans", opacity: 0.8 },
    ...lines(480, 220, ["Running one role", "end to end."], 46, 60, C.navy, 600, "display"),
    { t: "text", x: 480, y: 350, text: "Intake, sourcing, evidence review and the ranked shortlist —", size: 21, weight: 400, fill: C.slate, font: "sans" },
    { t: "text", x: 480, y: 382, text: "walked through inside the workspace.", size: 21, weight: 400, fill: C.slate, font: "sans" },
    ...pipeline(480, 480, 620, { onDark: false }),
    ...chip(480, 580, 220, 56, "Save your seat", C.ocean, C.white, 20),
  ],
});

export const caseStudyCover = (): Scene => ({
  width: 1200, height: 1553, background: C.paper,
  nodes: [
    { t: "rect", x: 0, y: 0, w: 1200, h: 620, fill: C.navyDark },
    wordmark(90, 90, 34, true),
    eyebrow(90, 240, "Case study", C.oceanLight, 16),
    ...lines(90, 360, ["Client name", "and the role"], 56, 72, C.white, 600, "display"),
    { t: "text", x: 90, y: 520, text: "Editable cover fields — replace before publishing.", size: 20, weight: 400, fill: C.sky, font: "sans", opacity: 0.8 },
    { t: "text", x: 90, y: 740, text: "The situation", size: 30, weight: 600, fill: C.navy, font: "display" },
    { t: "text", x: 90, y: 790, text: "Describe the hiring problem in the client's own terms.", size: 22, weight: 400, fill: C.slate, font: "sans" },
    { t: "text", x: 90, y: 890, text: "What we ran", size: 30, weight: 600, fill: C.navy, font: "display" },
    { t: "text", x: 90, y: 940, text: "Intake, sourcing cadence, review criteria, shortlist format.", size: 22, weight: 400, fill: C.slate, font: "sans" },
    ...pipeline(90, 1080, 700, { onDark: false }),
    { t: "rect", x: 90, y: 1220, w: 1020, h: 200, rx: 20, fill: C.sky, opacity: 0.5 },
    { t: "text", x: 130, y: 1290, text: "Results fields are intentionally empty.", size: 24, weight: 600, fill: C.navy, font: "display" },
    { t: "text", x: 130, y: 1334, text: "Add only verified, client-approved numbers. Do not publish", size: 20, weight: 400, fill: C.slate, font: "sans" },
    { t: "text", x: 130, y: 1364, text: "this cover with placeholder results in place.", size: 20, weight: 400, fill: C.slate, font: "sans" },
  ],
});

export const caseStudyResults = (): Scene => ({
  width: 1200, height: 1553, background: C.paper,
  nodes: [
    wordmark(90, 80, 30, false),
    eyebrow(90, 200, "Results layout", C.oceanText, 16),
    ...lines(90, 276, ["What changed"], 48, 0, C.navy, 600, "display"),
    ...[0, 1, 2].map<SceneNode>((i) => ({
      t: "rect", x: 90 + i * 348, y: 360, w: 324, h: 220, rx: 20, fill: C.sky, opacity: 0.55,
    })),
    ...["Metric", "Metric", "Metric"].flatMap<SceneNode>((label, i) => [
      { t: "text", x: 122 + i * 348, y: 430, text: label, size: 18, weight: 600, fill: C.slate, font: "sans", tracking: 1.6, uppercase: true },
      { t: "text", x: 122 + i * 348, y: 508, text: "—", size: 56, weight: 600, fill: C.navy, font: "display" },
      { t: "text", x: 122 + i * 348, y: 550, text: "Verified value required", size: 17, weight: 400, fill: C.slate, font: "sans" },
    ]),
    { t: "text", x: 90, y: 680, text: "Detail", size: 34, weight: 600, fill: C.navy, font: "display" },
    ...[0, 1, 2, 3].map<SceneNode>((i) => ({
      t: "line", x1: 90, y1: 740 + i * 54, x2: 1110, y2: 740 + i * 54, stroke: C.hairline, sw: 2,
    })),
    ...evidenceStack(90, 1000, 620, false, 4),
    { t: "text", x: 90, y: 1420, text: "Source and date required on every figure.", size: 20, weight: 500, fill: C.slate, font: "sans" },
  ],
});

export const quoteTemplate = (): Scene => ({
  width: 1080, height: 1080, background: C.navyDark,
  nodes: [
    wordmark(88, 88, 34, true),
    { t: "text", x: 88, y: 380, text: "\u201C", size: 180, weight: 700, fill: C.oceanLight, font: "display", opacity: 0.5 },
    ...lines(88, 480, ["Editable quote line one,", "line two, line three."], 56, 76, C.white, 600, "display"),
    { t: "line", x1: 88, y1: 720, x2: 240, y2: 720, stroke: C.ocean, sw: 4 },
    { t: "text", x: 88, y: 790, text: "Name, role, company", size: 26, weight: 600, fill: C.sky, font: "sans" },
    { t: "text", x: 88, y: 960, text: "Sample text — replace with an approved, attributed quote.", size: 22, weight: 400, fill: C.oceanLight, font: "sans" },
    { t: "text", x: 88, y: 996, text: "Never publish this template with the sample copy in place.", size: 22, weight: 400, fill: C.oceanLight, font: "sans" },
  ],
});

export const hiringAnnouncement = (): Scene => ({
  width: 1200, height: 1200, background: C.paper,
  nodes: [
    { t: "rect", x: 0, y: 0, w: 1200, h: 16, fill: C.ocean },
    wordmark(96, 96, 36, false),
    ...chip(96, 220, 190, 56, "We're hiring", C.sky, C.navy, 22),
    ...lines(96, 400, ["Role title", "goes here"], 68, 86, C.navy, 600, "display"),
    { t: "text", x: 96, y: 560, text: "Location · Employment type · Team", size: 26, weight: 500, fill: C.slate, font: "sans" },
    { t: "line", x1: 96, y1: 620, x2: 1104, y2: 620, stroke: C.hairline, sw: 2 },
    ...["What you'll own", "What we look for", "How the process runs"].flatMap<SceneNode>((label, i) => [
      { t: "circle", cx: 112, cy: 700 + i * 92, r: 10, fill: C.ocean },
      { t: "text", x: 150, y: 712 + i * 92, text: label, size: 30, weight: 500, fill: C.navy, font: "sans" },
    ]),
    ...chip(96, 1010, 300, 76, "Apply on taasflow.com", C.ocean, C.white, 24),
  ],
});

export const serviceAnnouncement = (): Scene => ({
  width: 1200, height: 1200, background: C.navyDark,
  nodes: [
    wordmark(96, 96, 36, true),
    ...chip(96, 220, 232, 56, "What's included", C.ocean, C.white, 22),
    ...lines(96, 400, ["ATS, recruiting", "and outreach in", "one subscription."], 64, 84, C.white, 600, "display"),
    ...pipeline(96, 760, 800, { onDark: true }),
    { t: "text", x: 96, y: 900, text: "Start with a paid pilot on one role before subscribing.", size: 27, weight: 400, fill: C.sky, font: "sans" },
    ...chip(96, 980, 260, 76, "taasflow.com/pilot", C.ocean, C.white, 22),
  ],
});

/* ---------------------------------------------------------------- *
 * Presentation and documents
 * ---------------------------------------------------------------- */

export const presentationTitle = (): Scene => ({
  width: 1920, height: 1080, background: C.navyDark,
  nodes: [
    { t: "rect", x: 0, y: 0, w: 1920, h: 1080, fill: C.navyDark },
    { t: "rect", x: 1180, y: 0, w: 740, h: 1080, fill: C.navy, opacity: 0.5 },
    wordmark(140, 130, 46, true),
    eyebrow(140, 380, "Presentation title slide", C.oceanLight, 18),
    ...lines(140, 500, ["Your whole hiring stack,", "all in one."], 78, 98, C.white, 600, "display"),
    { t: "text", x: 140, y: 700, text: IDENTITY.tagline, size: 32, weight: 500, fill: C.sky, font: "sans" },
    { t: "line", x1: 140, y1: 900, x2: 1040, y2: 900, stroke: C.navyLight, sw: 2 },
    { t: "text", x: 140, y: 954, text: "Presenter name · Date · taasflow.com", size: 24, weight: 500, fill: C.oceanLight, font: "sans" },
    ...pipeline(1300, 540, 480, { onDark: true }),
  ],
});

const documentCover = (w: number, h: number, label: string): Scene => ({
  width: w, height: h, background: C.paper,
  nodes: [
    { t: "rect", x: 0, y: 0, w, h: Math.round(h * 0.34), fill: C.navyDark },
    wordmark(Math.round(w * 0.08), Math.round(h * 0.06), Math.round(h * 0.026), true),
    { t: "text", x: Math.round(w * 0.08), y: Math.round(h * 0.19), text: label, size: Math.round(h * 0.014), weight: 600, fill: C.oceanLight, font: "sans", tracking: 2, uppercase: true },
    ...lines(Math.round(w * 0.08), Math.round(h * 0.25), ["Report title", "second line"], Math.round(h * 0.032), Math.round(h * 0.042), C.white, 600, "display"),
    { t: "text", x: Math.round(w * 0.08), y: Math.round(h * 0.44), text: "Prepared for", size: Math.round(h * 0.013), weight: 600, fill: C.slate, font: "sans", tracking: 1.6, uppercase: true },
    { t: "text", x: Math.round(w * 0.08), y: Math.round(h * 0.48), text: "Client name", size: Math.round(h * 0.022), weight: 600, fill: C.navy, font: "display" },
    { t: "text", x: Math.round(w * 0.08), y: Math.round(h * 0.55), text: "Date · Author · Version", size: Math.round(h * 0.014), weight: 400, fill: C.slate, font: "sans" },
    ...pipeline(Math.round(w * 0.08), Math.round(h * 0.72), Math.round(w * 0.6), { onDark: false }),
    { t: "line", x1: Math.round(w * 0.08), y1: Math.round(h * 0.9), x2: w - Math.round(w * 0.08), y2: Math.round(h * 0.9), stroke: C.hairline, sw: 2 },
    { t: "text", x: Math.round(w * 0.08), y: Math.round(h * 0.94), text: "taasflow.com", size: Math.round(h * 0.013), weight: 600, fill: C.oceanText, font: "sans" },
  ],
});

export const docCoverLetter = (): Scene => documentCover(1275, 1650, "US Letter · 8.5 x 11in at 150dpi");
export const docCoverA4 = (): Scene => documentCover(1240, 1754, "A4 · 210 x 297mm at 150dpi");

/* ---------------------------------------------------------------- *
 * Icons
 * ---------------------------------------------------------------- */

export const appIcon = (size: number): Scene => ({
  width: size, height: size, background: C.navyDark,
  nodes: [{ t: "image", href: LOGO.icon, x: size * 0.18, y: size * 0.18, w: size * 0.64, h: size * 0.64 }],
});

/* ---------------------------------------------------------------- *
 * Logo-system diagrams (vector-safe, used in the guide)
 * ---------------------------------------------------------------- */

export const clearSpaceDiagram = (): Scene => {
  const x = 120, y = 90, h = 72, w = h * LOGO_RATIO;
  const unit = h; // x = cap height of the mark
  return {
    width: 900, height: 340, background: C.paper,
    nodes: [
      { t: "rect", x: x - unit, y: y - unit, w: w + unit * 2, h: h + unit * 2, fill: C.sky, opacity: 0.45 },
      { t: "rect", x: x - unit, y: y - unit, w: w + unit * 2, h: h + unit * 2, stroke: C.ocean, sw: 2, fill: "none" },
      { t: "image", href: LOGO.light, x, y, w, h },
      { t: "text", x: x - unit / 2, y: y - unit / 2 + 6, text: "x", size: 20, weight: 700, fill: C.oceanText, anchor: "middle", font: "sans" },
      { t: "text", x: 120, y: 300, text: "Clear space = x on all sides, where x is the wordmark cap height.", size: 18, weight: 500, fill: C.slate, font: "sans" },
    ],
  };
};

export const gridDiagram = (): Scene => ({
  width: 900, height: 340, background: C.paper,
  nodes: [
    ...Array.from({ length: 12 }, (_, i) => ({
      t: "rect" as const, x: 60 + i * 65, y: 60, w: 45, h: 220, rx: 4, fill: C.ocean, opacity: 0.14,
    })),
    { t: "line", x1: 60, y1: 40, x2: 840, y2: 40, stroke: C.hairline, sw: 2 },
    { t: "text", x: 60, y: 316, text: "12 columns · 20px gutter · 1200px max content width · 8px base unit", size: 18, weight: 500, fill: C.slate, font: "sans" },
  ],
});
