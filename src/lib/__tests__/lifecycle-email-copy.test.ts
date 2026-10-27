import {describe,expect,it,vi} from "vitest";
vi.mock("../email-delivery", () => ({ queueEmail: vi.fn().mockResolvedValue("test-key"), deliverQueuedEmail: vi.fn().mockResolvedValue({accepted:true}) }));
import {queueEmail} from "../email-delivery";
import {formatLifecycleEmail,trialEndLabel,sendWelcomeTrialEmail} from "../billing-user-emails";
import {formatDailyReportDigestEmail,istDayBoundsForDigest} from "../admin-report-digest";
describe("lifecycle email clarity",()=>{
  it("does not ask Google signups to find a verification email that was never sent",async()=>{
    await sendWelcomeTrialEmail({to:"test@example.test",trialEndsAt:new Date("2030-01-01T00:00:00Z"),requiresEmailVerification:false});
    const content=vi.mocked(queueEmail).mock.calls.at(-1)![0].payload.text;
    expect(content).toContain("Google has verified your email");
    expect(content).not.toContain("verification link in your inbox");
  });
  it("keeps verification instructions for password signups",async()=>{
    await sendWelcomeTrialEmail({to:"test@example.test",trialEndsAt:new Date("2030-01-01T00:00:00Z")});
    expect(vi.mocked(queueEmail).mock.calls.at(-1)![0].payload.text).toContain("verification link in your inbox");
  });
  it("escapes recipient names and uses an explicit trial-end timezone",()=>{
    const email=formatLifecycleEmail({to:"test@example.test",name:'<img src=x onerror="bad">',title:"Test",lines:["<unsafe>"],action:"Open",path:"/clients"});
    expect(email.html).not.toContain('<img src=x');expect(email.html).toContain('&lt;unsafe&gt;');expect(trialEndLabel(new Date("2026-10-27T18:30:00Z"))).toContain("UTC");
  });
  it("keeps owner testing inside the total and distinguishes it from other accounts",()=>{
    const email=formatDailyReportDigestEmail({dayLabel:"Oct 26, 2026",total:4,activeUsers:1,clients:2,ownerReports:4,byUser:[],byPlatform:{"Meta Ads":4},byReportType:{WEEKLY:4},byPlan:{"Owner / admin testing":4}});
    expect(email.text).toContain("Owner / admin reports: 4 · Other account reports: 0");expect(email.text).toContain("Weekly: 4");expect(email.html).toContain("Reports completed");
  });
  it("handles IST month and year boundaries",()=>{
    const bounds=istDayBoundsForDigest(new Date("2027-01-01T18:30:00Z"));expect(bounds.label).toBe("Jan 1, 2027");expect(bounds.start.toISOString()).toBe("2026-12-31T18:30:00.000Z");
  });
});
