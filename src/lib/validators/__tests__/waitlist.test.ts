import { describe, expect, it } from "vitest";
import { waitlistSchema } from "../waitlist";

describe("waitlistSchema", () => {
  it("accepts a plain email with no plan or country", () => {
    const parsed = waitlistSchema.parse({ email: "person@example.com" });
    expect(parsed.email).toBe("person@example.com");
    expect(parsed.planId).toBeUndefined();
    expect(parsed.country).toBeUndefined();
  });

  it("trims and lowercases the email", () => {
    const parsed = waitlistSchema.parse({ email: "  Person@Example.COM  " });
    expect(parsed.email).toBe("person@example.com");
  });

  it("rejects an invalid email", () => {
    expect(waitlistSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a missing email", () => {
    expect(waitlistSchema.safeParse({}).success).toBe(false);
  });

  it("keeps a recognized planId", () => {
    const parsed = waitlistSchema.parse({ email: "a@b.com", planId: "professional" });
    expect(parsed.planId).toBe("professional");
  });

  it("drops an unrecognized planId rather than rejecting the whole submission", () => {
    const parsed = waitlistSchema.parse({ email: "a@b.com", planId: "enterprise" });
    expect(parsed.planId).toBeUndefined();
  });

  it("uppercases and trims the country code", () => {
    const parsed = waitlistSchema.parse({ email: "a@b.com", country: " us " });
    expect(parsed.country).toBe("US");
  });
});
