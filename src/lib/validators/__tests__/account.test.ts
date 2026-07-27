import { describe, expect, it } from "vitest";
import { accountSettingsSchema, DEFAULT_GOOGLE_DRIVE_FOLDER_NAME } from "../account";

describe("accountSettingsSchema", () => {
  it("distinguishes a field absent from the request (undefined) from one explicitly cleared (null) — the /api/account PATCH route relies on this to do partial updates without one section's save blanking out another's fields", () => {
    const onlyDriveToggle = accountSettingsSchema.parse({ googleDriveEnabled: true });
    expect(onlyDriveToggle.agencyName).toBeUndefined();
    expect(onlyDriveToggle.googleDriveEnabled).toBe(true);
    expect(onlyDriveToggle.googleDriveFolderName).toBeUndefined();

    const onlyAgencyName = accountSettingsSchema.parse({ agencyName: "Acme" });
    expect(onlyAgencyName.agencyName).toBe("Acme");
    expect(onlyAgencyName.googleDriveEnabled).toBeUndefined();
  });

  it("explicitly clears agencyName to null when sent as an empty string, distinct from leaving it out entirely", () => {
    const cleared = accountSettingsSchema.parse({ agencyName: "" });
    expect(cleared.agencyName).toBeNull();
  });

  it("trims agencyName and the Drive folder name", () => {
    const parsed = accountSettingsSchema.parse({ agencyName: "  Acme  ", googleDriveFolderName: "  My Folder  " });
    expect(parsed.agencyName).toBe("Acme");
    expect(parsed.googleDriveFolderName).toBe("My Folder");
  });

  it("rejects a blank Drive folder name", () => {
    const result = accountSettingsSchema.safeParse({ googleDriveFolderName: "   " });
    expect(result.success).toBe(false);
  });

  it("accepts an empty body — every field is optional, matching the PATCH route's partial-update contract", () => {
    const parsed = accountSettingsSchema.parse({});
    expect(parsed).toEqual({});
  });
});

describe("DEFAULT_GOOGLE_DRIVE_FOLDER_NAME", () => {
  it("matches the Prisma schema's own column default, so the GET route's fallback and a fresh row agree", () => {
    expect(DEFAULT_GOOGLE_DRIVE_FOLDER_NAME).toBe("NextReport Reports");
  });
});
