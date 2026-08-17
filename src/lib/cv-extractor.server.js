// Real CV text extraction for Cloudflare Workers.
// - PDF (text)     → unpdf (pure JS, edge-safe)
// - DOCX           → mammoth extractRawText
// - TXT / RTF      → decode + strip
// - Images / empty → needs_ocr = true
//
// Never throws — always returns a decision the pipeline can act on.
import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
/** Validates a CV's text layer immediately after upload to detect scanned images. */
export async function validateCvTextLayer(bytes) {
    // We assume PDF based on the upload constraints in the app.
    return extractCvText(bytes, "application/pdf");
}
function normalize(s) {
    return s
        .replace(/\r\n?/g, "\n")
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function looksLikePdf(bytes) {
    return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}
function looksLikeDocx(bytes) {
    // DOCX is a ZIP: 'PK\x03\x04'
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}
export async function extractCvText(bytes, mime, filename) {
    const nameLower = (filename ?? "").toLowerCase();
    const mimeLower = (mime ?? "").toLowerCase();
    // PDF
    if (mimeLower.includes("pdf") || looksLikePdf(bytes) || nameLower.endsWith(".pdf")) {
        try {
            const pdf = await getDocumentProxy(bytes);
            const { text, totalPages } = await unpdfExtractText(pdf, { mergePages: true });
            const merged = normalize(Array.isArray(text) ? text.join("\n\n") : text);
            if (merged.length >= 200) {
                return { text: merged, needs_ocr: false, extractor: "pdf", page_count: totalPages ?? null, chars: merged.length };
            }
            // If we got exactly zero characters, it's definitely unreadable (scanned/image).
            // If we got some text but it's very short, it's likely a header-only or bad extract.
            return {
                text: merged,
                needs_ocr: true,
                extractor: "pdf",
                page_count: totalPages ?? null,
                chars: merged.length,
                reason: merged.length === 0 ? "cv_unreadable" : "text_layer_too_short",
            };
        }
        catch (e) {
            const msg = e.message ?? "pdf_parse_failed";
            // Encrypted, corrupt, or non-standard → surface reason so admin knows.
            return {
                text: "",
                needs_ocr: false,
                extractor: "pdf",
                page_count: null,
                chars: 0,
                reason: /password|encrypt/i.test(msg) ? "encrypted_pdf" : `pdf_parse_failed:${msg.slice(0, 120)}`,
            };
        }
    }
    // DOCX
    if (mimeLower.includes("officedocument.wordprocessingml") ||
        nameLower.endsWith(".docx") ||
        (looksLikeDocx(bytes) && nameLower.endsWith(".docx"))) {
        try {
            const buf = Buffer.from(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
            const res = await mammoth.extractRawText({ buffer: buf });
            const merged = normalize(res.value ?? "");
            return {
                text: merged,
                needs_ocr: merged.length < 200,
                extractor: "docx",
                page_count: null,
                chars: merged.length,
                reason: merged.length < 200 ? "docx_too_short" : undefined,
            };
        }
        catch (e) {
            return {
                text: "",
                needs_ocr: false,
                extractor: "docx",
                page_count: null,
                chars: 0,
                reason: `docx_parse_failed:${e.message?.slice(0, 120)}`,
            };
        }
    }
    // Legacy .doc — not supported in-edge; require replacement.
    if (mimeLower === "application/msword" || nameLower.endsWith(".doc")) {
        return {
            text: "",
            needs_ocr: false,
            extractor: "unknown",
            page_count: null,
            chars: 0,
            reason: "legacy_doc_unsupported",
        };
    }
    // Plain text / RTF / other decodable
    if (mimeLower.startsWith("text/") || nameLower.endsWith(".txt") || nameLower.endsWith(".rtf")) {
        const decoded = normalize(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
        // Strip RTF control words if any.
        const stripped = normalize(decoded.replace(/\\[a-z]+-?\d* ?/gi, " ").replace(/[{}]/g, " "));
        return {
            text: stripped,
            needs_ocr: stripped.length < 200,
            extractor: "text",
            page_count: null,
            chars: stripped.length,
            reason: stripped.length < 200 ? "text_too_short" : undefined,
        };
    }
    // Image or unknown binary → OCR path
    if (mimeLower.startsWith("image/")) {
        return { text: "", needs_ocr: true, extractor: "unknown", page_count: null, chars: 0, reason: "image_needs_ocr" };
    }
    // Last resort: try decoding
    const decoded = normalize(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
    if (decoded.length >= 200) {
        return { text: decoded, needs_ocr: false, extractor: "unknown", page_count: null, chars: decoded.length };
    }
    return {
        text: decoded,
        needs_ocr: false,
        extractor: "unknown",
        page_count: null,
        chars: decoded.length,
        reason: "unsupported_format",
    };
}
