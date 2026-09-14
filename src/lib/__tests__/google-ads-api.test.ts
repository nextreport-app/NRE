import { afterEach, describe, expect, it } from "vitest";
import { isGoogleAdsApiConfigured } from "../integrations-config";
import { googleAdsDeveloperToken, isGoogleAdsOAuthConfigured } from "../google-ads-api";

describe("googleAdsDeveloperToken", () => {
  afterEach(() => {
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  });

  it("returns undefined when unset or blank", () => {
    expect(googleAdsDeveloperToken()).toBeUndefined();
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "   ";
    expect(googleAdsDeveloperToken()).toBeUndefined();
  });

  it("returns trimmed token when set", () => {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "  abc123  ";
    expect(googleAdsDeveloperToken()).toBe("abc123");
  });
});

describe("isGoogleAdsOAuthConfigured", () => {
  afterEach(() => {
    delete process.env.GOOGLE_ADS_CLIENT_ID;
    delete process.env.GOOGLE_ADS_CLIENT_SECRET;
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  });

  it("is true with OAuth client only — developer token not required", () => {
    process.env.GOOGLE_ADS_CLIENT_ID = "client-id";
    process.env.GOOGLE_ADS_CLIENT_SECRET = "client-secret";
    expect(isGoogleAdsOAuthConfigured()).toBe(true);
  });

  it("is false without client id or secret", () => {
    process.env.GOOGLE_ADS_CLIENT_SECRET = "secret";
    expect(isGoogleAdsOAuthConfigured()).toBe(false);
  });
});

describe("isGoogleAdsApiConfigured", () => {
  afterEach(() => {
    delete process.env.GOOGLE_ADS_CLIENT_ID;
    delete process.env.GOOGLE_ADS_CLIENT_SECRET;
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  });

  it("matches OAuth client check — developer token not required", () => {
    process.env.GOOGLE_ADS_CLIENT_ID = "client-id";
    process.env.GOOGLE_ADS_CLIENT_SECRET = "client-secret";
    expect(isGoogleAdsApiConfigured()).toBe(true);
    expect(isGoogleAdsOAuthConfigured()).toBe(true);
  });
});
