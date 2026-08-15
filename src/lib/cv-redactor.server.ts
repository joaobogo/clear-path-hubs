import { extractCvText } from "./cv-extractor.server";
import { stripContactLines } from "./evidence/quote-hygiene";

/**
 * Returns a redacted version of a CV's text content.
 * Since we can't easily "edit" a PDF in-edge, we provide the text content
 * with PII stripped for pre-interview review.
 */
export async function redactCv(bytes: Uint8Array, mime: string, filename: string): Promise<string> {
  const extracted = await extractCvText(bytes, mime, filename);
  if (!extracted.text) return "This CV could not be processed for preview. Please request contact details to view the original file.";
  
  // Reuse the evidence hygiene logic which is already battle-tested for PII removal.
  return stripContactLines(extracted.text);
}
