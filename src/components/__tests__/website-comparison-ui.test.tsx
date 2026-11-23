import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WebsiteMetricChange,
  websiteMetricChange,
} from "../website-metric-change";
import { WebsitePaidTraffic } from "../website-paid-traffic";
import type { WebsiteSnapshot } from "@/lib/website-dashboard/model";
it("keeps an actual negative bounce-rate delta green", () => {
  const html = renderToStaticMarkup(
    <WebsiteMetricChange metric="bounceRate" current={0.2} previous={0.3} />,
  );
  expect(html).toContain("text-emerald-400");
  expect(html).toContain("−10 pp");
  expect(
    renderToStaticMarkup(
      <WebsiteMetricChange metric="bounceRate" current={0.4} previous={0.3} />,
    ),
  ).toContain("text-red-400");
});
it("does not invent infinity or favorable evidence from zero, missing or stale data", () => {
  expect(websiteMetricChange("sessions", 15, 0).label).toBe("From zero");
  expect(websiteMetricChange("sessions", null, 15).label).toBe("—");
  expect(
    renderToStaticMarkup(
      <WebsiteMetricChange
        metric="sessions"
        current={10}
        previous={5}
        comparable={false}
      />,
    ),
  ).not.toContain("text-emerald-400");
});
it("keeps returned paid social and search visible without manufacturing missing rows", () => {
  const data = {
    channels: [
      { name: "Paid Social", sessions: 12 },
      { name: "Paid Search", sessions: 9 },
      { name: "Organic Search", sessions: 20 },
    ],
  } as WebsiteSnapshot;
  const html = renderToStaticMarkup(<WebsitePaidTraffic data={data} />);
  expect(html).toContain("Paid Social");
  expect(html).toContain("Paid Search");
  expect(html).not.toContain("Organic Search");
  const absent = renderToStaticMarkup(
    <WebsitePaidTraffic
      data={{ channels: [] } as unknown as WebsiteSnapshot}
    />,
  );
  expect(absent).toContain("no paid-channel rows");
  expect(absent).not.toContain(">0<");
});
