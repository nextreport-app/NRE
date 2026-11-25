import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WebsiteSessionsTrend } from "../website-sessions-trend";
import type { WebsiteSnapshot } from "@/lib/website-dashboard/model";
describe("daily website trend", () => {
  it("labels dates and zero values while keeping missing days as gaps", () => {
    const data = {days: 7, currentPeriod: {startIso: "2026-11-01", endIso: "2026-11-07"}, trend: [{date: "20261101", sessions: 5}, {date: "20261102", sessions: 0}, {date: "20261104", sessions: 3}]} as WebsiteSnapshot;
    const html = renderToStaticMarkup(<WebsiteSessionsTrend data={data}/>);
    expect(html).toContain('aria-label="Nov 2: 0 sessions"');
    expect(html).not.toContain('aria-label="Nov 3:');
    expect(html).toContain("Nov 7");
    expect(html).toContain("Daily sessions");
    expect(html.match(/stroke-linejoin="round"/g)).toHaveLength(2);
    expect(html.match(/role="button"/g)).toHaveLength(3);
  });
});
