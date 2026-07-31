import { describe, expect, it } from "vitest";
import { contactSchema } from "../contact";

function validInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Priya",
    email: "priya@example.com",
    subject: "General Enquiry",
    message: "I have a question about billing.",
    ...overrides,
  };
}

describe("contactSchema", () => {
  it("accepts a fully valid submission", () => {
    const parsed = contactSchema.parse(validInput());
    expect(parsed.name).toBe("Priya");
    expect(parsed.email).toBe("priya@example.com");
    expect(parsed.subject).toBe("General Enquiry");
    expect(parsed.message).toBe("I have a question about billing.");
  });

  it("trims name and message", () => {
    const parsed = contactSchema.parse(validInput({ name: "  Priya  ", message: "  Hello there!  " }));
    expect(parsed.name).toBe("Priya");
    expect(parsed.message).toBe("Hello there!");
  });

  it("trims and lowercases the email", () => {
    const parsed = contactSchema.parse(validInput({ email: "  Priya@Example.COM  " }));
    expect(parsed.email).toBe("priya@example.com");
  });

  it("rejects an invalid email", () => {
    expect(contactSchema.safeParse(validInput({ email: "not-an-email" })).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(contactSchema.safeParse(validInput({ name: "" })).success).toBe(false);
  });

  it("rejects a message shorter than 10 characters", () => {
    expect(contactSchema.safeParse(validInput({ message: "too short" })).success).toBe(false);
  });

  it("accepts a message of exactly 10 characters", () => {
    expect(contactSchema.safeParse(validInput({ message: "1234567890" })).success).toBe(true);
  });

  it("rejects an unrecognized subject", () => {
    expect(contactSchema.safeParse(validInput({ subject: "Not A Real Subject" })).success).toBe(false);
  });

  it.each([
    "General Enquiry",
    "Technical Support",
    "Billing Question",
    "Feature Request",
    "Report an Issue",
    "Partnership",
    "Other",
  ])("accepts the subject option %s", (subject) => {
    expect(contactSchema.safeParse(validInput({ subject })).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    expect(contactSchema.safeParse({}).success).toBe(false);
  });
});
