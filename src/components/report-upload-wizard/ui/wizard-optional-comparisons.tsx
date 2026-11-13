"use client";

import { PreviousMonthDataWizardPanel } from "@/components/previous-month-data-wizard-panel";
import { useWizardContext } from "../wizard-context";

export function WizardOptionalComparisons({ embedded = false }: { embedded?: boolean }) {
  const w = useWizardContext();
  if (w.reportType !== "WEEKLY" || w.dataSourceMode !== "csv") return null;

  const panel = (
    <PreviousMonthDataWizardPanel
      clientId={w.clientId}
      clientTimezone={w.clientTimezone}
      currencySymbol={w.currencySymbol}
      initialHasFile={w.previousMonthHasFile}
      initialUpdatedAt={w.previousMonthUpdatedAt}
      initialCampaigns={w.previousMonthCampaigns}
      initialSelectedCampaigns={w.previousMonthSelectedCampaigns}
      initialCampaignSpend={w.previousMonthCampaignSpend}
      includeInReport={w.includePreviousMonthComparison}
      onIncludeInReportChange={include => {
        w.onPreviousMonthSettingsChanged();
        w.setIncludePreviousMonthComparison(include);
      }}
      onUploadingChange={w.setPreviousMonthUploading}
      onUploaded={meta => {
        w.onPreviousMonthSettingsChanged();
        w.setPreviousMonthHasFile(true);
        w.setPreviousMonthUpdatedAt(new Date().toISOString());
        if (meta) {
          w.setPreviousMonthCampaigns(meta.campaigns);
          w.setPreviousMonthSelectedCampaigns(meta.selectedCampaigns);
          if (meta.campaignSpend) w.setPreviousMonthCampaignSpend(meta.campaignSpend);
        }
      }}
      onCampaignsChange={meta => {
        w.onPreviousMonthSettingsChanged();
        w.setPreviousMonthCampaigns(meta.campaigns);
        w.setPreviousMonthSelectedCampaigns(meta.selectedCampaigns);
      }}
    />
  );
  if (embedded) return panel;
  return <details className="rounded-lg border border-dash-border bg-dash-card p-4">
    <summary className="cursor-pointer text-sm font-semibold text-dash-ink">Optional comparisons{w.includePreviousMonthComparison ? " · Previous-month totals enabled" : ""}</summary>
    <div className="mt-4">{panel}</div>
  </details>;
}
