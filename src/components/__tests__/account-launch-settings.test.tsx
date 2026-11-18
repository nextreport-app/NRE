import {describe,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {writeFileSync} from "node:fs";
const {state}=vi.hoisted(()=>({state:{connected:true}}));
vi.mock("@/lib/auth",()=>({auth:async()=>({user:{id:"test"}})}));
vi.mock("@/lib/prisma",()=>({prisma:{user:{findUnique:async()=>({email:"test@example.invalid",reportBrandingMode:"hidden",planId:"starter",reportRetentionDays:30,metaConnectedName:state.connected?"Example user":null,metaConnectedUserId:state.connected?"123":null})}}}));
vi.mock("@/lib/subscription",()=>({getSubscriptionStatus:()=>({planId:"starter",isAdminOverride:false})}));
vi.mock("@/lib/visitor-geo",()=>({getVisitorCountryCode:async()=>"US",isIndiaCountryCode:()=>false}));
vi.mock("next/navigation",()=>({notFound:()=>{throw Error("not found")},useRouter:()=>({refresh(){}})}));
vi.mock("@/components/toast",()=>({useToast:()=>({showToast(){}})}));
vi.mock("@/components/account-settings-form",()=>({AccountSettingsForm:()=>null}));
vi.mock("@/components/report-retention-settings",()=>({ReportRetentionSettings:()=>null}));
vi.mock("@/components/google-drive-settings",()=>({GoogleDriveSettings:()=>null}));
vi.mock("@/components/meta-ads-settings",()=>({MetaAdsSettings:({initialConnectedName}:{initialConnectedName:string|null})=><p>{initialConnectedName?"Meta connected":"Connect Meta Ads"}</p>}));
vi.mock("@/components/google-ads-settings",()=>({GoogleAdsSettings:()=> <button>Connect Google Ads</button>}));
vi.mock("@/components/ga4-settings",()=>({Ga4Settings:()=> <button>Connect GA4</button>}));
vi.mock("@/components/tiktok-ads-settings",()=>({TikTokAdsSettings:()=> <button>Connect TikTok Ads</button>}));
import AccountPage from "@/app/(dashboard)/account/page";
import {ClientPlatformConnections} from "@/components/client-platform-connections";
describe("Meta launch settings",()=>{
 it.each([true,false])("collapses unreleased platforms while preserving Meta and automation help (connected=%s)",async connected=>{
  state.connected=connected;
  const html=renderToStaticMarkup(await AccountPage({searchParams:Promise.resolve({})}));
  expect(html).not.toContain("Choose Meta API sync or manual CSV upload in the report wizard.");
  expect(html).toContain(connected?"Meta connected":"Connect Meta Ads");
  const deferred=html.match(/<details[^>]*>\s*<summary[^>]*>Other platform connections[\s\S]*?<\/details>/)?.[0];
  expect(deferred).toBeDefined();expect(deferred?.split(">")[0]).not.toContain("open");
  for(const text of ["Google Ads API Sync","Google Analytics (GA4)","TikTok Ads"])expect(deferred).toContain(text);
  expect(html).toContain("Report notifications &amp; automations");
  for(const text of ["How to get a Slack webhook","Catch Hook","Run once","Save integrations"])expect(html).toContain(text);
  if(connected && process.env.NRE_ACCOUNT_REVIEW_HTML)writeFileSync(process.env.NRE_ACCOUNT_REVIEW_HTML,html);
 });
 it("shows the result when returning from a deferred connection flow",async()=>{
  const html=renderToStaticMarkup(await AccountPage({searchParams:Promise.resolve({google_ads_connected:"1"})}));
  expect(html).toMatch(/<details[^>]*open=""[^>]*>\s*<summary[^>]*>Other platform connections/);
 });
 it("keeps client connection setup Meta-only",()=>{
  const config={connected:false,detail:null,configured:true};
  const html=renderToStaticMarkup(<ClientPlatformConnections meta={config} googleAds={config} ga4={config} tiktok={config}/>);
  expect(html).toContain("Meta Ads");expect(html).not.toMatch(/Google Ads|TikTok|GA4/);
 });
});
