// LLM-driven candidate insights.
// Produces a rich, position-aware narrative, per-requirement verdicts with
// verbatim CV quotes, and a screening-answer analysis. Fails soft — a failure
// returns { ok:false, reason } so the pipeline can continue.
//
// Server-only. Uses the Lovable AI gateway (LOVABLE_API_KEY).
export const INSIGHTS_PARSER_VERSION = "candidate-insights@2026.07.23";
const MODEL = "google/gemini-2.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const SYSTEM = `You are a senior recruiter analyst. Given a candidate's CV, the position brief, and the candidate's screening answers, produce a rigorous, evidence-first briefing for the hiring organization.

Non-negotiables:
- The hiring organization is explicitly named in the input as "hiring_organization_name". You MUST use this name when referring to the employer.
- NEVER mention "Flow Group Ventures" (the platform) as the hiring entity unless that is the explicitly provided organization name.
- Ground every strength, concern, and verdict in the CV. When you cite the CV, quote it verbatim (short, <=200 chars) in "cv_quote".
- If the CV does not support a claim, mark the verdict "missing" or the support "no" or "unclear". Do NOT invent experience.
- "pitch_summary" is a punchy 3–5 sentence elevator pitch a recruiter could paste to a hiring manager. If the fit is strong, SELL the candidate with specific, verifiable proof from the CV. If the fit is weak, be honest and lead with the critical gaps in a professional, non-derogatory tone. Set "pitch_tone" to "sell" (strong fit), "balanced" (mixed), or "cautious" (weak fit).
- The narrative must be 2–3 short paragraphs (3–6 sentences each) describing the person's career story, seniority, and specific fit for THIS role — not a generic bio.
- Highlights are 3–6 concrete achievements from the CV (numbers/scope/impact where present).
- Strengths and concerns are ROLE-SPECIFIC: tie each one to something in the position brief.
- Return STRICT JSON matching the schema. Do not include prose outside JSON.`;
const SCHEMA_HINT = `{
  "pitch_summary": "3-5 sentence elevator pitch to a hiring manager (sell if strong, honest gaps if weak)",
  "pitch_tone": "sell|balanced|cautious",
  "narrative": "2-3 paragraphs",
  "headline_suggested": "one-line professional headline",
  "seniority": "junior|mid|senior|lead|executive|unknown",
  "highlights": ["achievement 1", "achievement 2"],
  "strengths": [{"title": "short", "detail": "why this matters for the role", "cv_quote": "verbatim <=200 chars or null"}],
  "concerns": [{"title": "short", "detail": "specific gap vs the position"}],
  "requirement_verdicts": [{
    "requirement_id": "req-0",
    "requirement_text": "verbatim requirement",
    "required": true,
    "verdict": "met|partial|missing|contradicted",
    "rationale": "1 sentence tying evidence (or its absence) to the requirement",
    "cv_quote": "verbatim <=200 chars or null"
  }],
  "screening_analysis": [{
    "question_id": "id",
    "question": "verbatim question",
    "candidate_answer": "verbatim answer",
    "cv_supports": "yes|no|unclear",
    "note": "1 sentence — does the CV corroborate the answer?"
  }],
  "overall_recommendation": "advance|consider|reject",
  "confidence": 0.0
}`;
function stripJsonFences(s) {
    return s.replace(/^\uFEFF/, "").replace(/^\s*```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
}
export async function generateCandidateInsights(input) {
    const key = process.env.LOVABLE_API_KEY;
    if (!key)
        return { ok: false, reason: "no_lovable_api_key" };
    const trimmedCv = (input.cv_text ?? "").slice(0, 20000);
    if (trimmedCv.trim().length < 60)
        return { ok: false, reason: "cv_too_short" };
    const positionBlock = [
        `HIRING ORGANIZATION: ${input.position.hiring_organization_name}`,
        `TITLE: ${input.position.title || "(untitled)"}`,
        input.position.description ? `\nDESCRIPTION:\n${input.position.description.slice(0, 2000)}` : "",
        `\nREQUIREMENTS (must-have marked required=true):`,
        ...input.position.requirements.map((r) => `- [${r.id}] ${r.required ? "MUST" : "NICE"}: ${r.text}`),
    ].join("\n");
    const screeningBlock = input.screening.length
        ? [
            "SCREENING ANSWERS:",
            ...input.screening.map((s) => `- [${s.question_id}] Q: ${s.question}\n  A (${s.answer_type}${s.required ? ", required" : ""}): ${s.answer || "(no answer)"}`),
        ].join("\n")
        : "SCREENING ANSWERS: (none captured)";
    const userMsg = [
        "Analyse the candidate against the position and screening below.",
        "",
        "POSITION:",
        positionBlock,
        "",
        screeningBlock,
        "",
        "CV TEXT:",
        trimmedCv,
        "",
        "Return ONLY JSON matching the schema — no prose, no markdown fences.",
        `Schema:\n${SCHEMA_HINT}`,
    ].join("\n");
    try {
        const res = await fetch(GATEWAY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: "system", content: SYSTEM },
                    { role: "user", content: userMsg },
                ],
                response_format: { type: "json_object" },
                temperature: 0.2,
            }),
        });
        if (!res.ok) {
            const body = await res.text();
            return { ok: false, reason: `gateway_${res.status}:${body.slice(0, 160)}` };
        }
        const j = (await res.json());
        const content = j.choices?.[0]?.message?.content ?? "";
        if (!content)
            return { ok: false, reason: "empty_completion" };
        const stripped = stripJsonFences(content);
        let parsed;
        try {
            parsed = JSON.parse(stripped);
        }
        catch {
            const first = stripped.indexOf("{");
            const last = stripped.lastIndexOf("}");
            if (first < 0 || last <= first)
                return { ok: false, reason: "non_json_completion" };
            try {
                parsed = JSON.parse(stripped.slice(first, last + 1));
            }
            catch {
                return { ok: false, reason: "non_json_completion" };
            }
        }
        const clampStr = (v, max = 400) => typeof v === "string" ? v.slice(0, max) : "";
        const arr = (v) => (Array.isArray(v) ? v : []);
        const clean = {
            pitch_summary: clampStr(parsed.pitch_summary, 1200),
            pitch_tone: (["sell", "balanced", "cautious"].includes(String(parsed.pitch_tone))
                ? parsed.pitch_tone
                : "balanced"),
            narrative: clampStr(parsed.narrative, 2400),
            headline_suggested: typeof parsed.headline_suggested === "string" ? parsed.headline_suggested.slice(0, 160) : null,
            seniority: (["junior", "mid", "senior", "lead", "executive"].includes(String(parsed.seniority))
                ? parsed.seniority
                : "unknown"),
            highlights: arr(parsed.highlights).map((x) => clampStr(x, 280)).filter(Boolean).slice(0, 8),
            strengths: arr(parsed.strengths)
                .map((x) => {
                const r = x;
                return {
                    title: clampStr(r.title, 120),
                    detail: clampStr(r.detail, 400),
                    cv_quote: typeof r.cv_quote === "string" && r.cv_quote.trim() ? r.cv_quote.slice(0, 220) : null,
                };
            })
                .filter((x) => x.title || x.detail)
                .slice(0, 8),
            concerns: arr(parsed.concerns)
                .map((x) => {
                const r = x;
                return { title: clampStr(r.title, 120), detail: clampStr(r.detail, 400) };
            })
                .filter((x) => x.title || x.detail)
                .slice(0, 8),
            requirement_verdicts: arr(parsed.requirement_verdicts)
                .map((x) => {
                const r = x;
                const verdict = String(r.verdict ?? "missing");
                return {
                    requirement_id: clampStr(r.requirement_id, 64) || "req",
                    requirement_text: clampStr(r.requirement_text, 400),
                    required: r.required === true,
                    verdict: (["met", "partial", "missing", "contradicted"].includes(verdict) ? verdict : "missing"),
                    rationale: clampStr(r.rationale, 400),
                    cv_quote: typeof r.cv_quote === "string" && r.cv_quote.trim() ? r.cv_quote.slice(0, 220) : null,
                };
            })
                .slice(0, 40),
            screening_analysis: arr(parsed.screening_analysis)
                .map((x) => {
                const r = x;
                const cv_supports = String(r.cv_supports ?? "unclear");
                return {
                    question_id: clampStr(r.question_id, 64),
                    question: clampStr(r.question, 300),
                    candidate_answer: clampStr(r.candidate_answer, 400),
                    cv_supports: (["yes", "no", "unclear"].includes(cv_supports) ? cv_supports : "unclear"),
                    note: clampStr(r.note, 300),
                };
            })
                .slice(0, 20),
            overall_recommendation: (["advance", "consider", "reject"].includes(String(parsed.overall_recommendation))
                ? parsed.overall_recommendation
                : "consider"),
            confidence: typeof parsed.confidence === "number"
                ? Math.max(0, Math.min(1, parsed.confidence))
                : 0.5,
            parser_version: INSIGHTS_PARSER_VERSION,
            generated_at: new Date().toISOString(),
        };
        return { ok: true, data: clean };
    }
    catch (e) {
        return { ok: false, reason: `fetch_failed:${e.message?.slice(0, 120)}` };
    }
}
