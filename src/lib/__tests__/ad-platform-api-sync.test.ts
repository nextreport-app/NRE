import { afterEach, describe, expect, it, vi } from "vitest";

describe("ad platform API sync visibility", () => {
  afterEach(() => {
    delete process.env.AD_PLATFORM_API_SYNC_ENABLED;
    vi.resetModules();
  });

  it("shows client platform connections in UI regardless of API sync env", async () => {
    delete process.env.AD_PLATFORM_API_SYNC_ENABLED;
    const { isClientPlatformConnectionsSectionVisible } = await import("../ad-platform-api-sync");
    expect(isClientPlatformConnectionsSectionVisible()).toBe(true);
  });

  it("enables Meta testing by default and allows an explicit kill switch", async () => {
    delete process.env.AD_PLATFORM_API_SYNC_ENABLED;
    const { isAdPlatformApiSyncEnabled } = await import("../ad-platform-api-sync");
    expect(isAdPlatformApiSyncEnabled()).toBe(true);
    process.env.AD_PLATFORM_API_SYNC_ENABLED = "false";
    expect(isAdPlatformApiSyncEnabled()).toBe(false);
  });

  it("enables functional API sync when env flag is true", async () => {
    process.env.AD_PLATFORM_API_SYNC_ENABLED = "true";
    const { isAdPlatformApiSyncEnabled, isClientPlatformConnectionsSectionVisible, isWizardApiSyncVisible, isWizardApiSyncEnabled } = await import(
      "../ad-platform-api-sync"
    );
    expect(isAdPlatformApiSyncEnabled()).toBe(true);
    expect(isWizardApiSyncVisible()).toBe(true);
    expect(isWizardApiSyncEnabled()).toBe(true);
    expect(isClientPlatformConnectionsSectionVisible()).toBe(true);
  });
});
