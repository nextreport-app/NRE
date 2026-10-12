import { afterEach, describe, expect, it } from "vitest";

describe("ad platform API sync visibility", () => {
  afterEach(() => {
    delete process.env.AD_PLATFORM_API_SYNC_ENABLED;
  });

  it("hides client platform connections by default", async () => {
    delete process.env.AD_PLATFORM_API_SYNC_ENABLED;
    const { isClientPlatformConnectionsSectionVisible } = await import("../ad-platform-api-sync");
    expect(isClientPlatformConnectionsSectionVisible()).toBe(false);
  });

  it("shows client platform connections when env flag is true", async () => {
    process.env.AD_PLATFORM_API_SYNC_ENABLED = "true";
    const { isClientPlatformConnectionsSectionVisible } = await import("../ad-platform-api-sync");
    expect(isClientPlatformConnectionsSectionVisible()).toBe(true);
  });
});
