import { describe, expect, it } from "vitest";
import { supportTicketFieldsSchema } from "../support-ticket";

describe("supportTicketFieldsSchema", () => {
  const valid = {
    name: "Priya Sharma",
    email: "priya@agency.com",
    category: "Wrong metrics or numbers" as const,
    message: "The cost per lead on slide 2 does not match my CSV export.",
  };

  it("accepts a minimal valid ticket", () => {
    expect(supportTicketFieldsSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a short message", () => {
    expect(supportTicketFieldsSchema.safeParse({ ...valid, message: "too short" }).success).toBe(false);
  });

  it("trims and lowercases email", () => {
    const parsed = supportTicketFieldsSchema.parse({ ...valid, email: "  Priya@Agency.COM  " });
    expect(parsed.email).toBe("priya@agency.com");
  });
});
