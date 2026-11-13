import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignObjectiveReview } from "../ui/campaign-objective-review";
import { wizardCopy } from "@/lib/wizard-i18n";
const props = { name: "Website campaign", objective: "WEBSITE LEADS", matched: true, needsConfirmation: false, source: "CSV" as const, children: <select aria-label="Objective"><option>Website leads</option></select> };
describe("campaign objective review", () => {
  it("uses the requested CSV introduction", () => {
    expect(wizardCopy("en").objectivesIntro).toBe("Detected from your CSV. Change a dropdown only if something looks wrong.");
  });
  it("keeps matched objectives collapsed with an explicit Change action", () => {
    const html = renderToStaticMarkup(<CampaignObjectiveReview {...props} />);
    expect(html).toContain("Matches CSV"); expect(html).toContain("WEBSITE LEADS");
    expect(html).toContain(">Change<"); expect(html).not.toContain('open=""');
    expect(html).not.toContain("bg-emerald");
  });
  it("identifies API data accurately", () => {
    const html = renderToStaticMarkup(<CampaignObjectiveReview {...props} source="Meta API" />);
    expect(html).toContain("Matches Meta API"); expect(html).not.toContain("Matches CSV");
  });
  it.each([{ matched: false, needsConfirmation: false }, { matched: true, needsConfirmation: true }])("opens objectives that need review: %o", state => {
    const html = renderToStaticMarkup(<CampaignObjectiveReview {...props} {...state} />);
    expect(html).toContain('open=""'); expect(html).toContain("Review objective");
    expect(html).not.toContain("Matches CSV"); expect(html).toContain("<select");
  });
});
