import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps, ReactNode } from "react";
import { ReportUploadWizard } from "../report-upload-wizard";
const { state } = vi.hoisted(() => ({ state: { clientId: "client-1", reportTypeLabel: () => "Weekly", step: 1, wizardKind: "ads", platform: "META", linkedMetaAdAccountId: "act_2022399724077" as string | null, selectedApiAdAccountId: null as string | null, dataSourceMode: "api", clientName: "FULL GORILLA APPAREL", visitedSteps: new Set([1]), requestWizardLeave: vi.fn(), reportType: "WEEKLY" } }));
vi.mock("../wizard-context", () => ({ WizardProvider: ({ children }: { children: ReactNode }) => children, useWizardContext: () => state }));
vi.mock("@/components/site-theme-provider", () => ({ useSiteTheme: () => ({ locale: "en" }) }));
vi.mock("../steps/import-step", () => ({ WizardImportStep: () => null }));
vi.mock("../steps/campaigns-step", () => ({ WizardCampaignsStep: () => null }));
vi.mock("../steps/metrics-step", () => ({ WizardMetricsStep: () => null }));
vi.mock("../steps/generate-step", () => ({ WizardGenerateStep: () => null }));
const render = () => renderToStaticMarkup(<ReportUploadWizard {...{} as ComponentProps<typeof ReportUploadWizard>} />);
beforeEach(() => { state.step = 1; state.platform = "META"; state.linkedMetaAdAccountId = "act_2022399724077"; state.selectedApiAdAccountId = null; state.dataSourceMode = "api"; });
describe("Import client account header", () => {
 it.each([1, 2, 3, 4])("keeps client actions available without loose toolbar links at wizard step %s", (step) => {
  state.step = step;
  const html = render();
  expect(html).toContain("Client actions");
  expect(html).toContain('aria-expanded="false"');
  expect(html).not.toContain('aria-label="Client report tools"');
 });

 it("displays the saved ID in brackets beside the client name", () => {
  const html = render();
  expect(html).toContain("FULL GORILLA APPAREL");
  expect(html).toContain("(Ad account ID: 2022399724077)");
  expect(html).not.toContain("act_2022399724077");
 });
 it("does not invent an ID before a successful first sync", () => {
  state.linkedMetaAdAccountId = null;
  expect(render()).not.toContain("(Ad account ID:");
 });
 it("shows a fetched selection before the first successful sync, without claiming it is linked", () => {
  state.linkedMetaAdAccountId = null;
  state.selectedApiAdAccountId = "act_1099815669247382";
  const html = render();
  expect(html).toContain("(Selected ad account ID: 1099815669247382)");
  expect(html).not.toContain("(Ad account ID:");
 });
 it("keeps the saved ID in the header when a different API account is selected", () => {
  state.selectedApiAdAccountId = "act_999";
  const html = render();
  expect(html).toContain("(Ad account ID: 2022399724077)");
  expect(html).not.toContain("999");
  expect(html).not.toContain("Selected ad account ID");
 });
 it("hides an unsaved API selection when switching to CSV", () => {
  state.linkedMetaAdAccountId = null;
  state.selectedApiAdAccountId = "act_999";
  state.dataSourceMode = "csv";
  expect(render()).not.toContain("ad account ID:");
 });
 it("keeps the ID display scoped to Import", () => {
  state.step = 3;
  expect(render()).not.toContain("(Ad account ID:");
 });
 it("does not display a saved Meta ID for another platform", () => {
  state.platform = "GOOGLE";
  expect(render()).not.toContain("(Ad account ID:");
 });
});
