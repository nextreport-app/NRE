import { describe, it, expect } from "vitest";
import { METRIC_ICON_ASSETS, resolveMetricIconId, type MetricIconId } from "../metric-icons";

const ICON_IDS: MetricIconId[] = ["spend", "reach", "impressions", "results", "ctr", "cost", "cpc"];

describe("METRIC_ICON_ASSETS", () => {
  it("has all 7 extracted icons, each a valid base64-encoded PNG", () => {
    for (const id of ICON_IDS) {
      const asset = METRIC_ICON_ASSETS[id];
      expect(asset.id).toBe(id);
      expect(asset.widthPx).toBe(120);
      expect(asset.heightPx).toBe(120);
      const bytes = Buffer.from(asset.base64, "base64");
      // PNG magic number.
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    }
  });
});

describe("resolveMetricIconId", () => {
  it("maps the well-known primary metrics to their literal template card icon", () => {
    expect(resolveMetricIconId({ key: "spend", format: "currency" })).toBe("spend");
    expect(resolveMetricIconId({ key: "cost", format: "currency" })).toBe("spend");
    expect(resolveMetricIconId({ key: "reach", format: "number" })).toBe("reach");
    expect(resolveMetricIconId({ key: "impressions", format: "number" })).toBe("impressions");
    expect(resolveMetricIconId({ key: "ctr", format: "percentage" })).toBe("ctr");
    expect(resolveMetricIconId({ key: "results", format: "number" })).toBe("results");
    expect(resolveMetricIconId({ key: "conversions", format: "number" })).toBe("results");
  });

  it("maps per-unit-cost (perUnitOf-tagged) currency metrics to the cost icon by default", () => {
    expect(resolveMetricIconId({ key: "cost_per_lead", format: "currency", perUnitOf: "website_leads" })).toBe("cost");
    expect(resolveMetricIconId({ key: "cost_per_result", format: "currency", perUnitOf: "results" })).toBe("cost");
  });

  it("maps CPC/CPV/CPE-flavored per-unit-cost metrics to the cpc icon", () => {
    expect(resolveMetricIconId({ key: "cpc_all", format: "currency", perUnitOf: "clicks_all" })).toBe("cpc");
    expect(resolveMetricIconId({ key: "cpc_link_click", format: "currency", perUnitOf: "link_clicks" })).toBe("cpc");
    expect(resolveMetricIconId({ key: "avg_cpv", format: "currency", perUnitOf: "video_views" })).toBe("cpc");
  });

  it("maps aggregate currency totals (no perUnitOf) to the spend icon", () => {
    expect(resolveMetricIconId({ key: "revenue", format: "currency" })).toBe("spend");
    expect(resolveMetricIconId({ key: "conv_value", format: "currency" })).toBe("spend");
  });

  it("maps percentage/ratio/duration formats to their category icon", () => {
    expect(resolveMetricIconId({ key: "conv_rate", format: "percentage" })).toBe("ctr");
    expect(resolveMetricIconId({ key: "results_roas", format: "ratio" })).toBe("cost");
    expect(resolveMetricIconId({ key: "video_avg_play_time", format: "duration" })).toBe("impressions");
  });

  it("defaults to the RESULTS icon for anything unrecognized (product direction)", () => {
    expect(resolveMetricIconId({ key: "some_future_metric", format: "number" })).toBe("results");
    expect(resolveMetricIconId({ key: "some_future_text_field", format: "text" })).toBe("results");
  });
});
