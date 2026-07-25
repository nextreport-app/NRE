import { describe, expect, it } from "vitest";
import { campaignStatusIndicator, deliveryStatusIndicator, isActiveDeliveryStatus } from "../delivery-status";

describe("isActiveDeliveryStatus", () => {
  it.each([
    ["Active", true],
    ["active", true],
    ["Delivering", true],
    ["Not delivering", false],
    ["not_delivering", false],
    ["Inactive", false],
    ["Paused", false],
    ["Campaign paused", false],
    ["", false],
  ])("classifies %s as active=%s", (status, expected) => {
    expect(isActiveDeliveryStatus(status)).toBe(expected);
  });

  it("treats null/undefined as not active", () => {
    expect(isActiveDeliveryStatus(null)).toBe(false);
    expect(isActiveDeliveryStatus(undefined)).toBe(false);
  });

  it("is not fooled by 'not_delivering' containing the substring 'delivering'", () => {
    expect(isActiveDeliveryStatus("not_delivering")).toBe(false);
  });
});

describe("deliveryStatusIndicator", () => {
  it("returns 'Paused' for a paused status", () => {
    expect(deliveryStatusIndicator("Campaign paused")).toBe("Paused");
  });

  it("returns 'Inactive' for a not-delivering/inactive status", () => {
    expect(deliveryStatusIndicator("Not delivering")).toBe("Inactive");
    expect(deliveryStatusIndicator("Inactive")).toBe("Inactive");
  });

  it("returns null for an active status", () => {
    expect(deliveryStatusIndicator("Active")).toBeNull();
  });

  it("returns null for a blank or unrecognized status, never guessing", () => {
    expect(deliveryStatusIndicator("")).toBeNull();
    expect(deliveryStatusIndicator("Learning")).toBeNull();
  });
});

describe("campaignStatusIndicator", () => {
  it("prefers 'Paused' when any ad set is paused, even if others are inactive", () => {
    expect(campaignStatusIndicator(["Not delivering", "Paused"])).toBe("Paused");
  });

  it("returns 'Inactive' when no ad set is paused but at least one is inactive", () => {
    expect(campaignStatusIndicator(["Active", "Not delivering"])).toBe("Inactive");
  });

  it("returns null when every ad set is active", () => {
    expect(campaignStatusIndicator(["Active", "Active"])).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(campaignStatusIndicator([])).toBeNull();
  });
});
