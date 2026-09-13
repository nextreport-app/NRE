import { describe, expect, it } from "vitest";
import { campaignTypeLabelColor, reportHeaderColor } from "../light-theme-colors";

describe("light theme text colors", () => {
  it("uses dark navy headers on light templates", () => {
    expect(reportHeaderColor(true)).toBe("0d1b2e");
    expect(reportHeaderColor(false)).toBe("94a3b8");
  });

  it("uses slate campaign labels instead of amber on light templates", () => {
    expect(campaignTypeLabelColor(true, "campaign")).toBe("334155");
    expect(campaignTypeLabelColor(false, "campaign")).toBe("f6ad55");
  });
});
