import {beforeEach,describe,expect,it,vi} from "vitest";
import {prisma} from "@/lib/prisma";
import {buildComparisonReportData} from "@/lib/nre/report-data";
import {parseCsvText} from "@/lib/nre/parse-csv";
import {buildShareComparisonReportData} from "@/lib/nre/share-comparison-report";
import SharedReportPage,{generateMetadata} from "../[token]/page";
import {ShareComparisonReportView} from "@/components/share-comparison-report-view";

vi.mock("@/lib/prisma",()=>({prisma:{report:{findUnique:vi.fn()}}}));
// A client view can be rendered as an element, but its functions cannot be
// invoked by server metadata. Deliberately expose no label helper here.
vi.mock("@/components/share-comparison-report-view",()=>({ShareComparisonReportView:vi.fn(()=>null)}));

function comparison(){
 const parsed=parseCsvText("Campaign name,Day,Amount spent (USD),Results,Result type,Reach,Impressions\nForms,2026-11-13,30,3,Leads (form),100,200\nForms,2026-11-06,20,2,Leads (form),100,200\nTraffic,2026-11-13,10,20,Link clicks,100,200\nTraffic,2026-11-06,10,10,Link clicks,100,200");
 return buildShareComparisonReportData(buildComparisonReportData({accountName:"Example",currencySymbol:"$",timezone:"UTC",mtdDailyRows:parsed.rows,csvHeaders:parsed.headers,periodA:{startIso:"2026-11-13",endIso:"2026-11-19"},periodB:{startIso:"2026-11-06",endIso:"2026-11-12"},now:new Date("2026-11-20T12:00:00Z")}),"META",{});
}
beforeEach(()=>vi.mocked(prisma.report.findUnique).mockReset());
describe("public comparison metadata server boundary",()=>{
 it("builds metadata from server-safe data and renders the client view as an element",async()=>{
  const data=comparison();
  vi.mocked(prisma.report.findUnique).mockResolvedValue({status:"COMPLETE",summaryJson:JSON.stringify(data),client:{currency:"USD",timezone:"UTC"}} as never);
  const params=Promise.resolve({token:"test-comparison"});
  const metadata=await generateMetadata({params});
  expect(metadata.title).toContain("Example — Comparison Report | NextReport");
  expect(metadata.description).toContain("Nov 13 - Nov 19, 2026 vs Nov 6 - Nov 12, 2026");
  expect(metadata.robots).toEqual({index:false,follow:false});
  const page=await SharedReportPage({params});
  expect(page.type).toBe(ShareComparisonReportView);
  expect(page.props.data).toMatchObject({kind:"comparison",accountName:"Example"});
  expect(ShareComparisonReportView).not.toHaveBeenCalled();
 });
 it("retains the missing-report metadata response",async()=>{
  vi.mocked(prisma.report.findUnique).mockResolvedValue(null);
  expect(await generateMetadata({params:Promise.resolve({token:"missing"})})).toEqual({title:"Report not found — NextReport"});
 });
});
