import { describe, expect, it } from "vitest";
import { buildWhatsAppChatUrl, normalizeWhatsAppDigits } from "@/lib/whatsapp-number";
import { whatsappNumberSchema } from "@/lib/validators/whatsapp-number";

describe("normalizeWhatsAppDigits", () => {
  it("keeps India +91 numbers", () => {
    expect(normalizeWhatsAppDigits("+91 98765 43210")).toBe("919876543210");
    expect(normalizeWhatsAppDigits("919876543210")).toBe("919876543210");
  });

  it("keeps US +1 numbers", () => {
    expect(normalizeWhatsAppDigits("+1 (555) 123-4567")).toBe("15551234567");
    expect(normalizeWhatsAppDigits("15551234567")).toBe("15551234567");
  });

  it("keeps UK +44 numbers", () => {
    expect(normalizeWhatsAppDigits("+44 7700 900123")).toBe("447700900123");
    expect(normalizeWhatsAppDigits("447700900123")).toBe("447700900123");
  });

  it("converts UK local 07… mobiles to 44…", () => {
    expect(normalizeWhatsAppDigits("07700900123")).toBe("447700900123");
  });

  it("handles 00 international prefix", () => {
    expect(normalizeWhatsAppDigits("0044 7700 900123")).toBe("447700900123");
  });

  it("does not prepend 91 to US 10-digit numbers", () => {
    expect(buildWhatsAppChatUrl("+1 617 555 1234")).toBe("https://wa.me/16175551234");
  });
});

describe("whatsappNumberSchema", () => {
  it("accepts India, US, and UK formats", () => {
    expect(whatsappNumberSchema.safeParse("+91 98765 43210").success).toBe(true);
    expect(whatsappNumberSchema.safeParse("+1 555 123 4567").success).toBe(true);
    expect(whatsappNumberSchema.safeParse("+44 7700 900123").success).toBe(true);
    expect(whatsappNumberSchema.safeParse("07700 900123").success).toBe(true);
  });

  it("rejects ambiguous bare 10-digit numbers", () => {
    expect(whatsappNumberSchema.safeParse("9876543210").success).toBe(false);
    expect(whatsappNumberSchema.safeParse("6175551234").success).toBe(false);
  });

  it("rejects too-short numbers", () => {
    expect(whatsappNumberSchema.safeParse("12345").success).toBe(false);
  });
});
