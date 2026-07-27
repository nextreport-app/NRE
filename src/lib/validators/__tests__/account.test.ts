import { describe, expect, it } from "vitest";
import { accountSettingsSchema } from "../account";

describe("accountSettingsSchema", () => {
  it("leaves agencyName undefined when the field is absent from the request", () => {
    const parsed = accountSettingsSchema.parse({});
    expect(parsed.agencyName).toBeUndefined();
  });

  it("explicitly clears agencyName to null when sent as an empty string, distinct from leaving it out entirely", () => {
    const cleared = accountSettingsSchema.parse({ agencyName: "" });
    expect(cleared.agencyName).toBeNull();
  });

  it("trims agencyName", () => {
    const parsed = accountSettingsSchema.parse({ agencyName: "  Acme  " });
    expect(parsed.agencyName).toBe("Acme");
  });

  it("accepts an empty body — agencyName is optional, matching the PATCH route's partial-update contract", () => {
    const parsed = accountSettingsSchema.parse({});
    expect(parsed).toEqual({});
  });
});
