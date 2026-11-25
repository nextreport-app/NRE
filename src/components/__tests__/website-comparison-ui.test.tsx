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

it("keeps channel change badges in the Change column only", async () => {
  const {WebsiteChannelComparison}=await import("../website-changes");
  const metric={sessions:100,totalUsers:15,newUsers:10,engagedSessions:50,engagementRate:.5,bounceRate:.5,screenPageViews:60,keyEvents:2,sessionKeyEventRate:.02,averageSessionDuration:90};
  const data: WebsiteSnapshot = {version:1,days:30,property:{propertyId:"123",displayName:"Test site",timezone:"UTC",currency:"USD"},checkedAt:"2026-11-25T12:00:00Z",currentPeriod:{startIso:"2026-10-26",endIso:"2026-11-24"},previousPeriod:{startIso:"2026-09-26",endIso:"2026-10-25"},current:metric,previous:metric,pages:[],trend:[],empty:false,warnings:[],channels:[{name:"Referral",...metric}],previousChannels:[{name:"Referral",...metric,sessions:50,totalUsers:5,engagementRate:.25}]};
  const html=renderToStaticMarkup(<WebsiteChannelComparison data={data} fresh/>);
  expect(html.match(/\+100%/g)).toHaveLength(1);
  expect(html).not.toContain("+200%");
  expect(html).not.toContain("+25 pp");
  expect(html).not.toContain("Previous:");
  expect(html).toContain("Page views");
  expect(html).toContain("Change compares sessions with the previous period");
});
