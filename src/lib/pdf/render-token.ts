import { createHmac, timingSafeEqual } from "node:crypto";

function pdfRenderSecret(): string {
  const secret =
    process.env.PDF_RENDER_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.META_APP_SECRET?.trim();
  if (!secret) throw new Error("PDF_RENDER_SECRET (or AUTH_SECRET) is not configured");
  return secret;
}

/** HMAC signature gating the server-side print view used for PDF export. */
export function signPdfRenderToken(shareToken: string): string {
  return createHmac("sha256", pdfRenderSecret()).update(shareToken).digest("hex");
}

export function verifyPdfRenderToken(shareToken: string, signature: string | null | undefined): boolean {
  if (!signature || !shareToken) return false;
  const expected = signPdfRenderToken(shareToken);
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
