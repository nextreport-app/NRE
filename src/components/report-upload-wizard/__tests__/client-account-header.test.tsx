import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps, ReactNode } from "react";
import { ReportUploadWizard } from "../report-upload-wizard";
const { state } = vi.hoisted(() => ({ state: { step: 1, wizardKind: "ads", platform: "META", linkedMetaAdAccountId: "act_2022399724077" as string | null, clientName: "FULL GORILLA APPAREL", visitedSteps: new Set([1]), requestWizardLeave: vi.fn(), reportType: "WEEKLY" } }));
vi.mock("../wizard-context", () => ({ WizardProvider: ({ children }: { children: ReactNode }) => children, useWizardContext: () => state }));
vi.mock("@/components/site-theme-provider", () => ({ useSiteTheme: () => ({ locale: "en" }) }));
vi.mock("../steps/import-step", () => ({ WizardImportStep: () => null }));
vi.mock("../steps/campaigns-step", () => ({ WizardCampaignsStep: () => null }));
vi.mock("../steps/metrics-step", () => ({ WizardMetricsStep: () => null }));
vi.mock("../steps/generate-step", () => ({ WizardGenerateStep: () => null }));
const render = () => renderToStaticMarkup(<ReportUploadWizard {...{} as ComponentProps<typeof ReportUploadWizard>} />);
beforeEach(() => { state.step = 1; state.platform = "META"; state.linkedMetaAdAccountId = "act_2022399724077"; });
describe("Import client account header", () => {
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
 it("keeps the ID display scoped to Import", () => {
  state.step = 3;
  expect(render()).not.toContain("(Ad account ID:");
 });
 it("does not display a saved Meta ID for another platform", () => {
  state.platform = "GOOGLE";
  expect(render()).not.toContain("(Ad account ID:");
 });
});
