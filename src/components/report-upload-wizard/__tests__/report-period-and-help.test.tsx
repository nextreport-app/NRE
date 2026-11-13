import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardPeriodSummary } from "../ui/wizard-period-summary";
import { WizardReportHelp } from "../ui/wizard-report-help";
import { SupportTicketLink } from "@/components/support-ticket-link";
describe("final report period summary", () => {
  it("pairs clear labels with the supplied regional dates", () => {
    const html = renderToStaticMarkup(<WizardPeriodSummary rows={[{label:"Weekly period",value:"06/11/2026 – 12/11/2026"},{label:"Month to date",value:"01/11/2026 – 12/11/2026"},{label:"Trend chart",value:"Last 30 days"}]} onChangeDates={()=>{}} />);
    expect(html).toContain("<dl");
    for (const text of ["Weekly period","Month to date","Trend chart","06/11/2026 – 12/11/2026","Last 30 days","Change dates"]) expect(html).toContain(text);
    expect(html).not.toContain(" week<");
  });
  it("omits the date action while dates are already being edited", () => {
    expect(renderToStaticMarkup(<WizardPeriodSummary rows={[{label:"Weekly period",value:"11/06/2026 – 11/12/2026"}]} />)).not.toContain("Change dates");
  });
});
describe("report help panel", () => {
  it("keeps report support, WhatsApp, and product feedback as distinct actions", () => {
    const html = renderToStaticMarkup(<WizardReportHelp clientId="client_123" />);
    for (const text of ["Need help with this report?","Support ticket","WhatsApp chat","Have an idea?","Send product feedback"]) expect(html).toContain(text);
    expect(html).toContain('href="/support?clientId=client_123"');
    expect(html).toContain('href="/feedback"');
    expect(html).toContain("wa.me/");
    expect(html.match(/target="_blank"/g)).toHaveLength(3);
    expect(html).not.toContain("or chat with us");
  });
  it("preserves the shared support link's existing default text and same-tab behavior", () => {
    const html = renderToStaticMarkup(<SupportTicketLink clientId="client" reportId="report" />);
    expect(html).toContain("Raise a support ticket");
    expect(html).toContain("reportId=report");
    expect(html).not.toContain('target="_blank"');
  });
});
