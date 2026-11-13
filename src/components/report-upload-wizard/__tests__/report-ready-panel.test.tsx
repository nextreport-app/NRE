import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardGenerateSuccessPanel } from "../ui/wizard-generate-success-panel";
import { wizardCopy } from "@/lib/wizard-i18n";
vi.mock("@/hooks/use-wizard-copy", () => ({ useWizardCopy: () => wizardCopy("en") }));
const props = {
  clientName:"Example account",clientId:"client",reportId:"report",reportTitle:"Weekly Performance Report",reportType:"WEEKLY" as const,reportTypeLabel:"Weekly overview",wizardSharePlatformLabel:"Meta Ads",slideCount:7,dateRangeLabel:"06/11/2026 – 12/11/2026",downloadUrl:"https://example.invalid/report.pptx",shareToken:"abc123",publishedAt:null,generatedAt:"2026-11-13T06:00:00Z",clientCurrency:"INR",clientTimezone:"Asia/Kolkata",clientShareMessageCopied:false,shareLinkCopied:false,onCopyClientShareMessage:vi.fn(),onCopyShareLink:vi.fn(),persistGenerateSnapshot:vi.fn(),hasGoogleDriveConnected:false,driveView:"collapsed" as const,driveSaving:false,handleSaveButtonClick:vi.fn(),rememberedFolder:null,setDriveView:vi.fn(),copied:false,driveSaveUrl:null,handleCopyLink:vi.fn(),handleGenerateAnother:vi.fn(),
};
describe("concise generated-report panel",()=>{
  it("keeps the report identity and actions without repeated introductory copy",()=>{
    const html=renderToStaticMarkup(<WizardGenerateSuccessPanel {...props}/>);
    for(const text of ["Report ready","Weekly Performance Report","06/11/2026 – 12/11/2026","7 slides","13/11/2026","Preview &amp; edit report","Download PPTX","Share report","Copy link"]) expect(html).toContain(text);
    for(const text of ["Ready to review","The final touch","Includes last week","Review your slides before sharing with your client."]) expect(html).not.toContain(text);
    expect(html).toContain("Anyone with this link can view the report.");
    expect(html).toContain("Save to Google Drive · optional");
  });
  it("includes report-aware help and a client-specific restart with one client-switch location",()=>{
    const html=renderToStaticMarkup(<WizardGenerateSuccessPanel {...props}/>);
    expect(html).toContain("Need help with this report?");
    expect(html).toContain("Support ticket");
    expect(html).toContain("WhatsApp chat");
    expect(html).toContain("clientId=client&amp;reportId=report");
    expect(html).toContain('Generate another report for <span class="font-semibold">Example account</span>');
    expect(html).not.toContain("All clients");
    expect(html.indexOf("Report help")).toBeGreaterThan(html.indexOf("Continue working"));
  });
  it("retains discrepancy warnings prominently",()=>{
    const html=renderToStaticMarkup(<WizardGenerateSuccessPanel {...props} generatedWithCsvMismatch/>);
    expect(html).toContain(wizardCopy("en").csvMismatchShareWarningTitle);
    expect(html).toContain(wizardCopy("en").csvMismatchShareWarningBody);
  });
  it("keeps active Drive editing content available",()=>{
    const html=renderToStaticMarkup(<WizardGenerateSuccessPanel {...props} hasGoogleDriveConnected driveView="editing"><p>Folder editor</p></WizardGenerateSuccessPanel>);
    expect(html).toContain("Folder editor");expect(html).toContain("Save to Drive");
    expect(html).not.toContain("Save to Google Drive · optional");
  });
  it("offers one download when a live link is not available yet",()=>{
    const html=renderToStaticMarkup(<WizardGenerateSuccessPanel {...props} shareToken={null}/>);
    expect(html.match(/Download PPTX/g)).toHaveLength(1);
    expect(html).toContain("Live link is still preparing");
  });
});
