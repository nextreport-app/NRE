import { describe, expect, it } from "vitest";
import { buildWhatsAppChatUrl, normalizeWhatsAppDigits } from "@/lib/whatsapp-number";
import { whatsappNumberSchema } from "@/lib/validators/whatsapp-number";

describe("whatsapp number helpers", () => {
  it("prepends 91 for 10-digit Indian mobiles", () => {
    expect(normalizeWhatsAppDigits("9876543210")).toBe("919876543210");
  });

  it("keeps numbers that already include country code", () => {
    expect(normalizeWhatsAppDigits("+91 88825 78327")).toBe("918882578327");
  });

  it("builds wa.me link", () => {
    expect(buildWhatsAppChatUrl("9876543210")).toBe("https://wa.me/919876543210");
  });
});

describe("whatsappNumberSchema", () => {
  it("accepts common formats", () => {
    expect(whatsappNumberSchema.safeParse("+91 98765 43210").success).toBe(true);
    expect(whatsappNumberSchema.safeParse("9876543210").success).toBe(true);
  });

  it("rejects too-short numbers", () => {
    expect(whatsappNumberSchema.safeParse("12345").success).toBe(false);
  });
});
