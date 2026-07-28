import { describe, expect, it } from "vitest";
import {
  campaignStatusIndicator,
  deliveryStatusIndicator,
  isActiveDeliveryStatus,
  isArchivedDeliveryStatus,
} from "../delivery-status";

describe("isActiveDeliveryStatus", () => {
  it.each([
    ["Active", true],
    ["active", true],
    ["Delivering", true],
    ["active_with_issues", true],
    ["Not delivering", false],
    ["not_delivering", false],
    ["Inactive", false],
    ["Paused", false],
    ["Campaign paused", false],
    ["Archived", false],
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

describe("isArchivedDeliveryStatus", () => {
  it("recognizes 'archived' case-insensitively", () => {
    expect(isArchivedDeliveryStatus("Archived")).toBe(true);
    expect(isArchivedDeliveryStatus("archived")).toBe(true);
  });

  it("returns false for other statuses, blank, null, or undefined", () => {
    expect(isArchivedDeliveryStatus("Active")).toBe(false);
    expect(isArchivedDeliveryStatus("Paused")).toBe(false);
    expect(isArchivedDeliveryStatus("")).toBe(false);
    expect(isArchivedDeliveryStatus(null)).toBe(false);
    expect(isArchivedDeliveryStatus(undefined)).toBe(false);
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

  it("returns 'Inactive' for an archived status", () => {
    expect(deliveryStatusIndicator("Archived")).toBe("Inactive");
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
  it("returns null (no badge) when at least one ad set is active, even if others are paused/inactive — the Fix 1 bug", () => {
    expect(campaignStatusIndicator(["Active", "Not delivering"])).toBeNull();
    expect(campaignStatusIndicator(["Not delivering", "Paused", "Active"])).toBeNull();
    expect(campaignStatusIndicator(["Archived", "active_with_issues"])).toBeNull();
  });

  it("returns 'Paused' when no ad set is active but at least one is explicitly paused", () => {
    expect(campaignStatusIndicator(["Not delivering", "Paused"])).toBe("Paused");
  });

  it("returns 'Inactive' when no ad set is active or explicitly paused", () => {
    expect(campaignStatusIndicator(["Not delivering", "Inactive"])).toBe("Inactive");
  });

  it("returns 'Inactive' when every ad set is archived", () => {
    expect(campaignStatusIndicator(["Archived", "Archived"])).toBe("Inactive");
  });

  it("returns null when every ad set is active", () => {
    expect(campaignStatusIndicator(["Active", "Active"])).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(campaignStatusIndicator([])).toBeNull();
  });
});
