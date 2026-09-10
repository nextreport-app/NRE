import { describe, expect, it } from "vitest";
import { bookDemoSchema } from "../book-demo";

function validInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Alex",
    email: "alex@agency.com",
    company: "Bright Media",
    teamSize: "2–5 people",
    message: "We run Meta reports for 12 clients weekly.",
    ...overrides,
  };
}

describe("bookDemoSchema", () => {
  it("accepts a fully valid submission", () => {
    const parsed = bookDemoSchema.parse(validInput());
    expect(parsed.name).toBe("Alex");
    expect(parsed.company).toBe("Bright Media");
  });

  it("trims and lowercases the email", () => {
    const parsed = bookDemoSchema.parse(validInput({ email: "  Alex@Agency.COM  " }));
    expect(parsed.email).toBe("alex@agency.com");
  });

  it("rejects an empty company name", () => {
    expect(bookDemoSchema.safeParse(validInput({ company: "" })).success).toBe(false);
  });

  it("rejects a message shorter than 10 characters", () => {
    expect(bookDemoSchema.safeParse(validInput({ message: "too short" })).success).toBe(false);
  });
});
