import { describe, expect, it } from "vitest";
import { messageForAuthSignInError } from "../auth-sign-in-errors";

describe("messageForAuthSignInError", () => {
  it("maps OAuthAccountNotLinked", () => {
    expect(messageForAuthSignInError("OAuthAccountNotLinked")).toMatch(/password/i);
  });

  it("returns null for empty", () => {
    expect(messageForAuthSignInError(null)).toBeNull();
    expect(messageForAuthSignInError("")).toBeNull();
  });
});
