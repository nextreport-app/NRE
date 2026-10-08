import { describe, expect, it } from "vitest";
import { GOOGLE_LOGIN_AUTHORIZATION_PARAMS } from "../auth-google-sign-in";

describe("GOOGLE_LOGIN_AUTHORIZATION_PARAMS", () => {
  it("forces Google account chooser", () => {
    expect(GOOGLE_LOGIN_AUTHORIZATION_PARAMS.prompt).toBe("select_account");
  });
});
