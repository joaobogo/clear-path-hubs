/**
 * A role can ask candidates one question for their introduction video.
 *
 * The prompt lives at positions.intake_context.posting.video_prompt. When set,
 * the job page invites a short video answering it and the apply form shows it
 * above the video link, with the label "(optional, highly recommended)". When
 * absent, both read exactly as before. The video stays optional, and only the
 * prompt (never the rest of intake_context) leaves the server.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  VIDEO_PROMPT_LEAD,
  VIDEO_PROMPT_MAX,
  normalizeVideoPrompt,
  videoFieldOptionalNote,
} from "@/lib/jobs/video-prompt";
import { VideoPromptQuote } from "@/components/candidate/video-prompt-quote";

const PROMPT = "What would you change in your first 90 days on our harvesting floor?";

describe("normalizeVideoPrompt", () => {
  it("keeps a real prompt, trimmed and on one line", () => {
    expect(normalizeVideoPrompt(`  ${PROMPT}  `)).toBe(PROMPT);
    expect(normalizeVideoPrompt("What would you change\n  in your first 90 days?")).toBe(
      "What would you change in your first 90 days?",
    );
  });

  it("ignores a missing, blank or non-string prompt", () => {
    for (const raw of [undefined, null, "", "   ", "\n\t", 42, true, { text: PROMPT }, [PROMPT]]) {
      expect(normalizeVideoPrompt(raw)).toBeNull();
    }
    expect(normalizeVideoPrompt('""')).toBeNull();
  });

  it("drops quotes the author typed around it (the page adds its own)", () => {
    expect(normalizeVideoPrompt(`"${PROMPT}"`)).toBe(PROMPT);
    expect(normalizeVideoPrompt(`“${PROMPT}”`)).toBe(PROMPT);
    // Quotes inside the prompt are the author's and stay.
    expect(normalizeVideoPrompt('What does "ownership" mean to you?')).toBe(
      'What does "ownership" mean to you?',
    );
    expect(normalizeVideoPrompt('Tell us about "ownership"')).toBe('Tell us about "ownership"');
  });

  it(`caps a long prompt at ${VIDEO_PROMPT_MAX} characters on a word boundary`, () => {
    const long = `${"Tell us about a harvest you planned end to end ".repeat(12)}and why.`;
    const out = normalizeVideoPrompt(long)!;
    expect(out.length).toBeLessThanOrEqual(VIDEO_PROMPT_MAX);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
    expect(long.startsWith(out.slice(0, -1))).toBe(true);
    const exact = "a".repeat(VIDEO_PROMPT_MAX);
    expect(normalizeVideoPrompt(exact)).toBe(exact);
  });

  it("never shows a prompt the shared protected-attribute detector flags", () => {
    expect(normalizeVideoPrompt("Tell us your age and nationality")).toBeNull();
    expect(normalizeVideoPrompt("As a native English speaker, tell us why you fit")).toBeNull();
    expect(normalizeVideoPrompt("Candidates must be under 35: tell us about yourself")).toBeNull();
  });

  it("keeps ordinary questions about the work", () => {
    for (const prompt of [
      PROMPT,
      "Tell us about a time you led a team across cultures and languages.",
      "What did you learn in the last year that changed how you work?",
      "Describe your experience in the Korean market.",
    ]) {
      expect(normalizeVideoPrompt(prompt)).toBe(prompt);
    }
  });
});

describe("the video field label", () => {
  it("reads exactly as before without a prompt", () => {
    expect(videoFieldOptionalNote(null)).toBe("(optional)");
    expect(videoFieldOptionalNote(undefined)).toBe("(optional)");
    expect(videoFieldOptionalNote("")).toBe("(optional)");
  });

  it("recommends the video, still optional, when the role asks a question", () => {
    expect(videoFieldOptionalNote(PROMPT)).toBe("(optional, highly recommended)");
  });
});

describe("VideoPromptQuote", () => {
  it("leads with the hiring team's line and quotes the prompt", () => {
    const html = renderToStaticMarkup(<VideoPromptQuote id="loom_url-prompt" prompt={PROMPT} />);
    expect(VIDEO_PROMPT_LEAD).toBe("The hiring team would love to hear your answer to:");
    expect(html).toContain(VIDEO_PROMPT_LEAD);
    expect(html).toContain(`“${PROMPT}”`);
    expect(html).toContain('id="loom_url-prompt"');
    expect(html).toContain("<blockquote");
  });

  it("escapes the prompt as text", () => {
    const html = renderToStaticMarkup(<VideoPromptQuote prompt="<img src=x onerror=alert(1)>" />);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

const src = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
/** Source with comments removed, so prose cannot satisfy a check. */
const code = (rel: string) =>
  src(rel)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("where the prompt comes from and where it shows", () => {
  it("the public position exposes only the vetted prompt, read as one JSON path", () => {
    const jobs = code("src/lib/jobs.functions.ts");
    expect(jobs).toContain('.select("video_prompt:intake_context->posting->>video_prompt")');
    expect(jobs).toContain("normalizeVideoPrompt(");
    expect(jobs).toMatch(/video_prompt:\s*videoPrompt/);
    // No other read of intake_context in the public job module.
    const mentions = jobs.match(/intake_context[^\s,)"`]*/g) ?? [];
    expect(mentions).toEqual(["intake_context->posting->>video_prompt"]);
  });

  it("the apply form shows the prompt above the link and keeps the field optional", () => {
    const apply = code("src/routes/jobs.$id.apply.tsx");
    expect(apply).toContain("videoFieldOptionalNote(videoPrompt)");
    expect(apply).toMatch(
      /\{videoPrompt && \([\s\S]*?<VideoPromptQuote id="loom_url-prompt" prompt=\{videoPrompt\} \/>/,
    );
    // The prompt sits above the link input.
    expect(apply.indexOf("<VideoPromptQuote")).toBeLessThan(apply.indexOf('id="loom_url"'));
    // No validation was added for the video.
    expect(src("src/lib/apply-schema.ts")).not.toMatch(/video_prompt|videoPrompt/);
  });

  it("the job page invites a video only when the role has a prompt and is open", () => {
    const page = code("src/routes/jobs.$id.index.tsx");
    expect(page).toContain("Stand out with a short video");
    expect(page).toMatch(
      /\{pos\.video_prompt && pos\.accepting_applications \? \([\s\S]*?Stand out with a short video[\s\S]*?<VideoPromptQuote prompt=\{pos\.video_prompt\}/,
    );
  });
});
